import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingCrmSettingCategory,
  Prisma,
} from '../../prisma/generated/client';
import { AccountingClient } from '../accounting/accounting.client';
import { callAccounting } from '../accounting/call-accounting';
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
  'This rep already has a target for the same product that overlaps these dates';
const NOT_FOUND_MESSAGE = 'Target not found';
const ENTITIES_PER_CALL = 100;
const TRANSACTIONS_PER_CALL = 500;

type TargetRow = Prisma.MarketingSalesTargetGetPayload<object>;
type Range = { from: string; to: string };

const day = (date: Date) => date.toISOString().slice(0, 10);
const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const chunks = <T>(items: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
};

/**
 * A rep's target is judged on money Accounting has received (the same figure the client cards
 * show), for the clients the rep owns, dated within the target's period. Achievement is read live
 * and never stored, so a reversal in Accounting lowers it the next time anyone looks.
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

  async create(user: RequestUser, dto: CreateSalesTargetDto) {
    this.assertPeriod(dto.startDate, dto.endDate);
    await this.assertRep(user, dto.userId);
    if (dto.productId) await this.assertProduct(user.tenantId, dto.productId);
    await this.assertNoOverlap(
      user.tenantId,
      dto.userId,
      dto.productId ?? null,
      asDate(dto.startDate),
      asDate(dto.endDate),
    );

    const created = await this.prisma.marketingSalesTarget.create({
      data: {
        tenantId: user.tenantId,
        userId: dto.userId,
        productId: dto.productId ?? null,
        startDate: asDate(dto.startDate),
        endDate: asDate(dto.endDate),
        amount: new Prisma.Decimal(dto.amount),
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
    });
    return (await this.withProgress(user, [created]))[0];
  }

  async update(user: RequestUser, id: string, dto: UpdateSalesTargetDto) {
    await this.findOrThrow(user.tenantId, id);
    const updated = await this.prisma.marketingSalesTarget.update({
      where: { id },
      data: {
        amount: new Prisma.Decimal(dto.amount),
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

    const [names, productNames, clients] = await Promise.all([
      this.assignees.namesFor(tenantId, userIds),
      this.productNames(tenantId, productIds),
      this.prisma.marketingClient.findMany({
        where: {
          tenantId,
          assignedUserId: { in: userIds },
          accountingEntityId: { not: null },
        },
        select: { id: true, assignedUserId: true, accountingEntityId: true },
      }),
    ]);

    const entitiesByRep = new Map<string, string[]>();
    const repByClient = new Map<string, string>();
    for (const client of clients) {
      if (!client.accountingEntityId) continue;
      repByClient.set(client.id, client.assignedUserId);
      const list = entitiesByRep.get(client.assignedUserId) ?? [];
      list.push(client.accountingEntityId);
      entitiesByRep.set(client.assignedUserId, list);
    }

    // Transactions raised for a product, by rep, only needed for product targets.
    const transactionsByRepProduct = new Map<string, string[]>();
    if (productIds.length > 0) {
      const billings = await this.prisma.marketingClientBilling.findMany({
        where: {
          tenantId,
          productId: { in: productIds },
          clientId: { in: [...repByClient.keys()] },
        },
        select: {
          clientId: true,
          productId: true,
          accountingTransactionId: true,
        },
      });
      for (const billing of billings) {
        const rep = repByClient.get(billing.clientId);
        if (!rep || !billing.productId) continue;
        const key = `${rep}:${billing.productId}`;
        const list = transactionsByRepProduct.get(key) ?? [];
        list.push(billing.accountingTransactionId);
        transactionsByRepProduct.set(key, list);
      }
    }

    let currency = null as string | null;
    let accountingUp = true;
    const achievedFor = async (target: TargetRow): Promise<string | null> => {
      if (!accountingUp) return null;
      const range = { from: day(target.startDate), to: day(target.endDate) };
      try {
        if (!target.productId) {
          const entityIds = entitiesByRep.get(target.userId) ?? [];
          if (entityIds.length === 0) return '0.00';
          const result = await this.receivedByEntities(user, entityIds, range);
          currency = result.currency || currency;
          return result.amount;
        }
        const transactionIds =
          transactionsByRepProduct.get(
            `${target.userId}:${target.productId}`,
          ) ?? [];
        const anyEntity = entitiesByRep.get(target.userId)?.[0];
        if (transactionIds.length === 0 || !anyEntity) return '0.00';
        const result = await this.receivedByTransactions(
          user,
          anyEntity,
          transactionIds,
          range,
        );
        currency = result.currency || currency;
        return result.amount;
      } catch (error) {
        accountingUp = false;
        this.logger.warn(
          `target progress unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
        return null;
      }
    };

    // Targets with the same rep, product and dates share one answer.
    const cache = new Map<string, Promise<string | null>>();
    const rows = await Promise.all(
      targets.map(async (target) => {
        const key = `${target.userId}:${target.productId ?? ''}:${day(target.startDate)}:${day(target.endDate)}`;
        const pending = cache.get(key) ?? achievedFor(target);
        cache.set(key, pending);
        const achieved = await pending;
        return { target, achieved };
      }),
    );

    return rows.map(({ target, achieved }) => {
      const amount = new Prisma.Decimal(target.amount);
      const got = achieved === null ? null : new Prisma.Decimal(achieved);
      return {
        id: target.id,
        userId: target.userId,
        userName: names.get(target.userId) ?? null,
        productId: target.productId,
        productName: target.productId
          ? (productNames.get(target.productId) ?? null)
          : null,
        startDate: day(target.startDate),
        endDate: day(target.endDate),
        amount: amount.toFixed(2),
        achieved: got ? got.toFixed(2) : null,
        remaining: got
          ? Prisma.Decimal.max(amount.minus(got), 0).toFixed(2)
          : null,
        percent: got
          ? got.div(amount).times(100).toDecimalPlaces(1).toNumber()
          : null,
        currency,
        canEdit: this.canManage(user),
      };
    });
  }

  private async receivedByEntities(
    user: RequestUser,
    entityIds: string[],
    range: Range,
  ) {
    let total = new Prisma.Decimal(0);
    let currency = '';
    for (const batch of chunks(entityIds, ENTITIES_PER_CALL)) {
      const summary = await callAccounting(this.logger, () =>
        this.accounting.receiptsSummary(
          { tenantId: user.tenantId, entityIds: batch, ...range },
          user.id,
        ),
      );
      currency = summary.currency;
      for (const entity of summary.entities) {
        total = total.plus(entity.receivedAmount);
      }
    }
    return { amount: total.toFixed(2), currency };
  }

  private async receivedByTransactions(
    user: RequestUser,
    entityId: string,
    transactionIds: string[],
    range: Range,
  ) {
    let total = new Prisma.Decimal(0);
    let currency = '';
    for (const batch of chunks(transactionIds, TRANSACTIONS_PER_CALL)) {
      const summary = await callAccounting(this.logger, () =>
        this.accounting.receiptsSummary(
          {
            tenantId: user.tenantId,
            entityIds: [entityId],
            transactionIds: batch,
            ...range,
          },
          user.id,
        ),
      );
      currency = summary.currency;
      for (const transaction of summary.transactions) {
        total = total.plus(transaction.receivedAmount);
      }
    }
    return { amount: total.toFixed(2), currency };
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

  private async assertRep(user: RequestUser, userId: string) {
    const reps = await this.assignees.activeUsers(user.tenantId);
    if (!reps.some((rep) => rep.userId === userId)) {
      throw new BadRequestException(REP_NOT_ELIGIBLE_MESSAGE);
    }
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
    userId: string,
    productId: string | null,
    startDate: Date,
    endDate: Date,
  ) {
    const clash = await this.prisma.marketingSalesTarget.findFirst({
      where: {
        tenantId,
        userId,
        productId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    });
    if (clash) throw new ConflictException(OVERLAP_MESSAGE);
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
