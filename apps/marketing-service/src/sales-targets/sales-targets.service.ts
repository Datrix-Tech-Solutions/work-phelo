import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingClientBillingState,
  MarketingCrmSettingCategory,
  Prisma,
} from '../../prisma/generated/client';
import { AccountingClient } from '../accounting/accounting.client';
import { AssigneesService } from '../assignees/assignees.service';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSalesTargetDto,
  QuerySalesTargetsDto,
  UpdateSalesTargetDto,
} from './dto/sales-target.dto';

const REP_NOT_ELIGIBLE_MESSAGE =
  'The selected person cannot have a target. Choose an active Marketing user.';
const PRODUCT_INVALID_MESSAGE = 'Choose a product from CRM Settings';
const PERIOD_INVALID_MESSAGE = 'The end date cannot be before the start date';
const OVERLAP_MESSAGE =
  'already has a target for the same product that overlaps these dates';
const ENDED_MESSAGE = 'The dates of a target that has ended cannot be changed';
const NOT_FOUND_MESSAGE = 'Target not found';
const DAY_MS = 86_400_000;
/** An invoice counts while it is submitted or posted; a rejected or reversed one counts for nothing. */
const LIVE_INVOICE_STATES = [
  MarketingClientBillingState.SUBMITTED,
  MarketingClientBillingState.POSTED,
];

type TargetRow = Prisma.MarketingSalesTargetGetPayload<object>;

const day = (date: Date) => date.toISOString().slice(0, 10);
const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

export interface InvoiceRow {
  amount: Prisma.Decimal;
  productId: string | null;
  createdAt: Date;
  clientId: string;
  client: { assignedUserId: string };
}

/**
 * Adds up invoices, optionally for one rep, one product and a date range (YYYY-MM-DD, inclusive,
 * judged on the day the invoice was raised).
 */
export function sumInvoiced(
  rows: InvoiceRow[],
  filter: {
    userId?: string;
    productId?: string | null;
    from?: string;
    to?: string;
  } = {},
): Prisma.Decimal {
  const from = filter.from ? asDate(filter.from).getTime() : null;
  const to = filter.to ? asDate(filter.to).getTime() + DAY_MS : null;
  let total = new Prisma.Decimal(0);
  for (const row of rows) {
    if (filter.userId && row.client.assignedUserId !== filter.userId) continue;
    if (filter.productId && row.productId !== filter.productId) continue;
    const at = row.createdAt.getTime();
    if (from !== null && at < from) continue;
    if (to !== null && at >= to) continue;
    total = total.plus(row.amount);
  }
  return total;
}

/**
 * A rep's target is judged on the invoices raised for the clients the rep owns (the same figure
 * the client cards show), dated within the target's period. Payments are not tracked here.
 * Achievement is read live and never stored, so a rejected or reversed invoice stops counting.
 */
@Injectable()
export class SalesTargetsService {
  private readonly logger = new Logger(SalesTargetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingClient,
    private readonly assignees: AssigneesService,
  ) {}

  canManage(user: RequestUser) {
    return this.isAdmin(user) || user.permissions.includes(P.TARGETS_EDIT);
  }

  canViewAll(user: RequestUser) {
    return this.isAdmin(user) || user.permissions.includes(P.TARGETS_VIEW_ALL);
  }

  /** Reps a target can be set for: active Marketing users. */
  reps(user: RequestUser) {
    return this.assignees.activeUsers(user.tenantId);
  }

  async list(user: RequestUser, query: QuerySalesTargetsDto) {
    const viewAll = this.canViewAll(user);
    if (query.userId && query.userId !== user.id && !viewAll) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    const date = query.date ? asDate(query.date) : undefined;
    const targets = await this.prisma.marketingSalesTarget.findMany({
      where: {
        tenantId: user.tenantId,
        ...(viewAll ? {} : { userId: user.id }),
        ...(query.userId ? { userId: query.userId } : {}),
        ...(date ? { startDate: { lte: date }, endDate: { gte: date } } : {}),
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return this.withProgress(user, targets);
  }

  /** Targets whose period overlaps [from, to] (YYYY-MM-DD), with progress, for dashboards. */
  async listOverlapping(user: RequestUser, from: string, to: string) {
    const targets = await this.prisma.marketingSalesTarget.findMany({
      where: {
        tenantId: user.tenantId,
        ...(this.canViewAll(user) ? {} : { userId: user.id }),
        startDate: { lte: asDate(to) },
        endDate: { gte: asDate(from) },
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return this.withProgress(user, targets);
  }

  /**
   * Sets the same target for every rep in the request, all or nothing: if any rep is not an
   * eligible Marketing user or already has an overlapping target, none are created.
   */
  async create(user: RequestUser, dto: CreateSalesTargetDto) {
    this.assertPeriod(dto.startDate, dto.endDate);
    const reps = await this.assertReps(user, dto.userIds);
    if (dto.productId) await this.assertProduct(user.tenantId, dto.productId);
    await this.assertNoOverlap(
      user.tenantId,
      reps,
      dto.productId ?? null,
      asDate(dto.startDate),
      asDate(dto.endDate),
    );

    const created = await this.prisma.$transaction(
      dto.userIds.map((userId) =>
        this.prisma.marketingSalesTarget.create({
          data: {
            tenantId: user.tenantId,
            name: dto.name,
            userId,
            productId: dto.productId ?? null,
            startDate: asDate(dto.startDate),
            endDate: asDate(dto.endDate),
            amount: new Prisma.Decimal(dto.amount),
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
        }),
      ),
    );
    return this.withProgress(user, created);
  }

  /**
   * Changes the amount and, while the target has not ended, its dates. The dates are checked
   * against the rep's other targets for the same product, as when a target is created.
   */
  async update(user: RequestUser, id: string, dto: UpdateSalesTargetDto) {
    const existing = await this.findOrThrow(user.tenantId, id);
    const startDate = dto.startDate ?? day(existing.startDate);
    const endDate = dto.endDate ?? day(existing.endDate);
    const datesChanged =
      startDate !== day(existing.startDate) ||
      endDate !== day(existing.endDate);

    if (datesChanged) {
      if (day(existing.endDate) < day(new Date())) {
        throw new BadRequestException(ENDED_MESSAGE);
      }
      this.assertPeriod(startDate, endDate);
      const names = await this.assignees.namesFor(user.tenantId, [
        existing.userId,
      ]);
      await this.assertNoOverlap(
        user.tenantId,
        new Map([[existing.userId, names.get(existing.userId) ?? 'This rep']]),
        existing.productId,
        asDate(startDate),
        asDate(endDate),
        id,
      );
    }

    const updated = await this.prisma.marketingSalesTarget.update({
      where: { id },
      data: {
        amount: new Prisma.Decimal(dto.amount),
        ...(datesChanged
          ? { startDate: asDate(startDate), endDate: asDate(endDate) }
          : {}),
        updatedByUserId: user.id,
      },
    });
    return (await this.withProgress(user, [updated]))[0];
  }

  async remove(user: RequestUser, id: string) {
    await this.findOrThrow(user.tenantId, id);
    await this.prisma.marketingSalesTarget.delete({ where: { id } });
  }

  // ---- progress ----

  private async withProgress(user: RequestUser, targets: TargetRow[]) {
    const tenantId = user.tenantId;
    const userIds = [...new Set(targets.map((t) => t.userId))];
    const productIds = targets
      .map((t) => t.productId)
      .filter((id): id is string => Boolean(id));

    const [names, productNames, invoices, currency] = await Promise.all([
      this.assignees.namesFor(tenantId, userIds),
      this.productNames(tenantId, productIds),
      this.invoiceRows(tenantId, { assignedUserId: { in: userIds } }),
      this.baseCurrency(user),
    ]);

    const rows = targets.map((target) => ({
      target,
      achieved: sumInvoiced(invoices, {
        userId: target.userId,
        productId: target.productId,
        from: day(target.startDate),
        to: day(target.endDate),
      }).toFixed(2),
    }));

    return rows.map(({ target, achieved }) => {
      const amount = new Prisma.Decimal(target.amount);
      const got = new Prisma.Decimal(achieved);
      return {
        id: target.id,
        name: target.name,
        userId: target.userId,
        userName: names.get(target.userId) ?? null,
        productId: target.productId,
        productName: target.productId
          ? (productNames.get(target.productId) ?? null)
          : null,
        startDate: day(target.startDate),
        endDate: day(target.endDate),
        amount: amount.toFixed(2),
        achieved: got.toFixed(2),
        remaining: Prisma.Decimal.max(amount.minus(got), 0).toFixed(2),
        percent: got.div(amount).times(100).toDecimalPlaces(1).toNumber(),
        currency,
        canEdit: this.canManage(user),
      };
    });
  }

  /** Live invoices raised for the clients matching `where`, with who owns each client. */
  async invoiceRows(
    tenantId: string,
    where: Prisma.MarketingClientWhereInput = {},
  ): Promise<InvoiceRow[]> {
    return this.prisma.marketingClientBilling.findMany({
      where: {
        tenantId,
        state: { in: LIVE_INVOICE_STATES },
        client: where,
      },
      select: {
        amount: true,
        productId: true,
        createdAt: true,
        clientId: true,
        client: { select: { assignedUserId: true } },
      },
    });
  }

  /** The tenant's base currency from Accounting, for labelling; null when it cannot be read. */
  async baseCurrency(user: RequestUser): Promise<string | null> {
    if (!this.accounting.isConfigured()) return null;
    try {
      const options = await this.accounting.getOptions(user.tenantId, user.id);
      return options.baseCurrency ?? null;
    } catch (error) {
      this.logger.warn(
        `base currency unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }

  // ---- checks ----

  private isAdmin(user: RequestUser) {
    return user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN';
  }

  private assertPeriod(startDate: string, endDate: string) {
    if (endDate < startDate) {
      throw new BadRequestException(PERIOD_INVALID_MESSAGE);
    }
  }

  /** Every id must be an active Marketing user; returns their names for error messages. */
  private async assertReps(user: RequestUser, userIds: string[]) {
    const reps = await this.assignees.activeUsers(user.tenantId);
    const byId = new Map(reps.map((rep) => [rep.userId, rep.name]));
    if (!userIds.every((id) => byId.has(id))) {
      throw new BadRequestException(REP_NOT_ELIGIBLE_MESSAGE);
    }
    return new Map(userIds.map((id) => [id, byId.get(id) ?? 'This rep']));
  }

  private async assertProduct(tenantId: string, productId: string) {
    const product = await this.prisma.marketingCrmSettingOption.findFirst({
      where: {
        id: productId,
        tenantId,
        category: MarketingCrmSettingCategory.PRODUCT,
      },
      select: { id: true },
    });
    if (!product) throw new BadRequestException(PRODUCT_INVALID_MESSAGE);
  }

  private async assertNoOverlap(
    tenantId: string,
    reps: Map<string, string>,
    productId: string | null,
    startDate: Date,
    endDate: Date,
    excludeId?: string,
  ) {
    const clashes = await this.prisma.marketingSalesTarget.findMany({
      where: {
        tenantId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        userId: { in: [...reps.keys()] },
        productId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { userId: true },
    });
    if (clashes.length === 0) return;

    const names = [...new Set(clashes.map((c) => reps.get(c.userId)))].map(
      (name) => name ?? 'A rep',
    );
    throw new ConflictException(
      names.length === 1
        ? `${names[0]} ${OVERLAP_MESSAGE}`
        : `${names.join(', ')} already have targets for the same product that overlap these dates`,
    );
  }

  private async findOrThrow(tenantId: string, id: string) {
    const target = await this.prisma.marketingSalesTarget.findFirst({
      where: { id, tenantId },
    });
    if (!target) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return target;
  }

  private async productNames(tenantId: string, ids: string[]) {
    if (ids.length === 0) return new Map<string, string>();
    const options = await this.prisma.marketingCrmSettingOption.findMany({
      where: { tenantId, id: { in: [...new Set(ids)] } },
      select: { id: true, name: true },
    });
    return new Map(options.map((o) => [o.id, o.name]));
  }
}
