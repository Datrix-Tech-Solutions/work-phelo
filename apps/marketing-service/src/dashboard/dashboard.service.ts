import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingClientBillingState,
  MarketingClientProductStatus,
  MarketingCrmSettingCategory,
  Prisma,
} from '../../prisma/generated/client';
import { AssigneesService } from '../assignees/assignees.service';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { PrismaService } from '../prisma/prisma.service';
import {
  SalesTargetsService,
  sumInvoiced,
} from '../sales-targets/sales-targets.service';
import {
  DashboardGrowthPoint,
  DashboardRevenueByProduct,
  DashboardSalesPersonnel,
  DashboardStage,
  DashboardSummary,
  QueryDashboardGrowthDto,
  QueryDashboardRevenueDto,
  QueryDashboardSalesPersonnelDto,
  QueryDashboardSummaryDto,
} from './dto/dashboard-summary.dto';

const DAY_MS = 86_400_000;
const ZERO = new Prisma.Decimal(0);

/** Half-open [from, to): `to` is the day after the last day shown. */
type Range = { from: Date; to: Date };
type DayRange = { from: string; to: string };

const startOf = (value: string) => new Date(`${value}T00:00:00.000Z`);
const toRange = (from: string, to: string): Range => ({
  from: startOf(from),
  to: new Date(startOf(to).getTime() + DAY_MS),
});
const inRange = (at: Date, range: Range) => at >= range.from && at < range.to;
const money = (value: Prisma.Decimal) => value.toFixed(2);
const chunks = <T>(items: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
};

/**
 * Figures for the Marketing dashboard. Everything is scoped like the lists it summarises: a
 * user without the view-all permission sees only prospects and clients assigned to them.
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly targets: SalesTargetsService,
    private readonly assignees: AssigneesService,
  ) {}

  async summary(
    user: RequestUser,
    query: QueryDashboardSummaryDto,
  ): Promise<DashboardSummary> {
    const days: DayRange = { from: query.fromDate, to: query.toDate };
    const prevDays: DayRange = {
      from: query.prevFromDate,
      to: query.prevToDate,
    };
    const current = toRange(days.from, days.to);
    const previous = toRange(prevDays.from, prevDays.to);

    const prospectScope = this.canViewAll(user, P.PROSPECTS_VIEW_ALL)
      ? {}
      : { assignedUserId: user.id };
    const clientScope = this.canViewAll(user, P.CLIENTS_VIEW_ALL)
      ? {}
      : { assignedUserId: user.id };

    const [
      currentFunnel,
      previousFunnel,
      won,
      expected,
      pipeline,
      clients,
      achieved,
      targets,
    ] = await Promise.all([
      this.funnel(user.tenantId, prospectScope, current),
      this.funnel(user.tenantId, prospectScope, previous),
      this.wonDeals(user.tenantId, clientScope),
      this.expectedClosing(user.tenantId, prospectScope, clientScope, current),
      this.pipeline(user.tenantId, prospectScope, current),
      this.clientCounts(user.tenantId, clientScope, current),
      this.achievedRevenue(user, clientScope, days, prevDays),
      this.targetProgress(user, days),
    ]);

    const wonNow = won.filter((deal) => inRange(deal.at, current));
    const wonBefore = won.filter((deal) => inRange(deal.at, previous));
    const sum = (deals: typeof won) =>
      deals.reduce((total, deal) => total.plus(deal.value), ZERO);

    return {
      currency: achieved.currency,
      newProspects: {
        current: currentFunnel.created,
        previous: previousFunnel.created,
      },
      conversion: {
        created: currentFunnel.created,
        converted: currentFunnel.converted,
        previousCreated: previousFunnel.created,
        previousConverted: previousFunnel.converted,
      },
      sales: {
        won: money(sum(wonNow)),
        previousWon: money(sum(wonBefore)),
        wonDeals: wonNow.length,
        expected: money(expected),
      },
      achievedRevenue: {
        current: achieved.current,
        previous: achieved.previous,
      },
      pipeline,
      targets,
      clients,
    };
  }

  /** Prospects and clients created in each range, scoped like the lists they come from. */
  async growth(
    user: RequestUser,
    query: QueryDashboardGrowthDto,
  ): Promise<DashboardGrowthPoint[]> {
    const ranges = query.ranges.split(',').map((pair) => {
      const [from, to] = pair.split(':');
      if (to < from) {
        throw new BadRequestException(`Range ${pair} ends before it starts`);
      }
      return { from, to };
    });
    const prospectScope = this.canViewAll(user, P.PROSPECTS_VIEW_ALL)
      ? {}
      : { assignedUserId: user.id };
    const clientScope = this.canViewAll(user, P.CLIENTS_VIEW_ALL)
      ? {}
      : { assignedUserId: user.id };

    return Promise.all(
      ranges.map(async ({ from, to }) => {
        const window = toRange(from, to);
        const createdAt = { gte: window.from, lt: window.to };
        const [newProspects, newClients] = await Promise.all([
          this.prisma.marketingProspect.count({
            where: { tenantId: user.tenantId, ...prospectScope, createdAt },
          }),
          this.prisma.marketingClient.count({
            where: { tenantId: user.tenantId, ...clientScope, createdAt },
          }),
        ]);
        return { fromDate: from, toDate: to, newProspects, newClients };
      }),
    );
  }

  /**
   * Invoices raised in the range, per product. An invoice carries the product it was raised for.
   * Rejected or reversed invoices are left out; payments are not tracked here.
   */
  async revenueByProduct(
    user: RequestUser,
    query: QueryDashboardRevenueDto,
  ): Promise<DashboardRevenueByProduct> {
    const clientScope = this.canViewAll(user, P.CLIENTS_VIEW_ALL)
      ? {}
      : { assignedUserId: user.id };
    const [invoices, currency] = await Promise.all([
      this.targets.invoiceRows(user.tenantId, clientScope),
      this.targets.baseCurrency(user),
    ]);

    const range = toRange(query.fromDate, query.toDate);
    const byProduct = new Map<string | null, Prisma.Decimal>();
    for (const invoice of invoices) {
      if (!inRange(invoice.createdAt, range)) continue;
      byProduct.set(
        invoice.productId,
        (byProduct.get(invoice.productId) ?? ZERO).plus(invoice.amount),
      );
    }

    const productIds = [...byProduct.keys()].filter(
      (id): id is string => id !== null,
    );
    const names = new Map(
      (productIds.length
        ? await this.prisma.marketingCrmSettingOption.findMany({
            where: {
              tenantId: user.tenantId,
              id: { in: productIds },
              category: MarketingCrmSettingCategory.PRODUCT,
            },
            select: { id: true, name: true },
          })
        : []
      ).map((option) => [option.id, option.name]),
    );

    const products = [...byProduct.entries()]
      .sort(([, a], [, b]) => b.comparedTo(a))
      .map(([productId, amount]) => ({
        productId,
        name:
          productId === null
            ? 'No product'
            : (names.get(productId) ?? 'Unknown product'),
        amount: money(amount),
      }));
    const total = [...byProduct.values()].reduce((sum, v) => sum.plus(v), ZERO);

    return { currency, total: money(total), products };
  }

  /**
   * Every rep who owns prospects or clients, or has pipeline value in the period, with the
   * figures the dashboard ranks them on. Prospects, clients and conversion are what each rep
   * holds now; expected and achieved are for the period. Scoped like the lists: without view-all, only the caller appears.
   */
  async salesPersonnel(
    user: RequestUser,
    query: QueryDashboardSalesPersonnelDto,
  ): Promise<DashboardSalesPersonnel> {
    const range = toRange(query.fromDate, query.toDate);
    const days: DayRange = { from: query.fromDate, to: query.toDate };
    const tenantId = user.tenantId;
    const prospectScope = this.canViewAll(user, P.PROSPECTS_VIEW_ALL)
      ? {}
      : { assignedUserId: user.id };
    const clientScope = this.canViewAll(user, P.CLIENTS_VIEW_ALL)
      ? {}
      : { assignedUserId: user.id };
    const expectedCloseDate = { gte: range.from, lt: range.to };

    const [
      prospects,
      created,
      converted,
      clients,
      clientProducts,
      prospectProducts,
      invoices,
    ] = await Promise.all([
      this.prisma.marketingProspect.groupBy({
        by: ['assignedUserId'],
        where: { tenantId, ...prospectScope, client: { is: null } },
        _count: { _all: true },
      }),
      this.prisma.marketingProspect.groupBy({
        by: ['assignedUserId'],
        where: { tenantId, ...prospectScope },
        _count: { _all: true },
      }),
      this.prisma.marketingProspect.groupBy({
        by: ['assignedUserId'],
        where: { tenantId, ...prospectScope, client: { isNot: null } },
        _count: { _all: true },
      }),
      this.prisma.marketingClient.groupBy({
        by: ['assignedUserId'],
        where: { tenantId, ...clientScope },
        _count: { _all: true },
      }),
      this.prisma.marketingClientProduct.findMany({
        where: {
          tenantId,
          status: MarketingClientProductStatus.PENDING,
          expectedCloseDate,
          client: clientScope,
        },
        select: {
          expectedValue: true,
          client: { select: { assignedUserId: true } },
        },
      }),
      this.prisma.marketingProspectProduct.findMany({
        where: {
          tenantId,
          expectedCloseDate,
          prospect: { ...prospectScope, client: { is: null } },
        },
        select: {
          expectedValue: true,
          prospect: { select: { assignedUserId: true } },
        },
      }),
      this.targets.invoiceRows(tenantId, clientScope),
    ]);

    const prospectCount = new Map(
      prospects.map((row) => [row.assignedUserId, row._count._all]),
    );
    const createdCount = new Map(
      created.map((row) => [row.assignedUserId, row._count._all]),
    );
    const convertedCount = new Map(
      converted.map((row) => [row.assignedUserId, row._count._all]),
    );
    const clientCount = new Map(
      clients.map((row) => [row.assignedUserId, row._count._all]),
    );
    const expected = new Map<string, Prisma.Decimal>();
    const addExpected = (userId: string, value: Prisma.Decimal | null) => {
      if (!value) return;
      expected.set(userId, (expected.get(userId) ?? ZERO).plus(value));
    };
    for (const row of clientProducts) {
      addExpected(row.client.assignedUserId, row.expectedValue);
    }
    for (const row of prospectProducts) {
      addExpected(row.prospect.assignedUserId, row.expectedValue);
    }
    const userIds = [
      ...new Set([
        ...prospectCount.keys(),
        ...createdCount.keys(),
        ...clientCount.keys(),
        ...expected.keys(),
        ...invoices.map((row) => row.client.assignedUserId),
      ]),
    ];

    const currency = await this.targets.baseCurrency(user);

    const names = new Map<string, string>();
    for (const batch of chunks(userIds, 50)) {
      for (const [id, name] of await this.assignees.namesFor(tenantId, batch)) {
        names.set(id, name);
      }
    }

    return {
      currency,
      reps: userIds.map((id) => {
        const made = createdCount.get(id) ?? 0;
        const won = convertedCount.get(id) ?? 0;
        return {
          userId: id,
          name: names.get(id) || 'Unknown user',
          prospects: prospectCount.get(id) ?? 0,
          clients: clientCount.get(id) ?? 0,
          created: made,
          converted: won,
          conversion: made > 0 ? Math.round((won / made) * 1000) / 10 : null,
          expected: money(expected.get(id) ?? ZERO),
          achieved: money(sumInvoiced(invoices, { userId: id, ...days })),
        };
      }),
    };
  }

  private canViewAll(user: RequestUser, permission: string) {
    return (
      user.role === 'SUPER_ADMIN' ||
      user.role === 'TENANT_ADMIN' ||
      user.permissions.includes(permission)
    );
  }

  /**
   * Prospects created in the range, and how many of those have since become clients. Counting
   * the converted ones from the same group keeps the rate at or below 100%.
   */
  private async funnel(
    tenantId: string,
    scope: { assignedUserId?: string },
    range: Range,
  ) {
    const where: Prisma.MarketingProspectWhereInput = {
      tenantId,
      ...scope,
      createdAt: { gte: range.from, lt: range.to },
    };
    const [created, converted] = await Promise.all([
      this.prisma.marketingProspect.count({ where }),
      this.prisma.marketingProspect.count({
        where: { ...where, client: { isNot: null } },
      }),
    ]);
    return { created, converted };
  }

  /**
   * Deals won: client products currently Purchased, dated by their first posted transaction
   * (a product has no purchase date of its own). Valued at the expected value it carried.
   */
  private async wonDeals(
    tenantId: string,
    clientScope: { assignedUserId?: string },
  ) {
    const [billings, purchased] = await Promise.all([
      this.prisma.marketingClientBilling.findMany({
        where: {
          tenantId,
          state: MarketingClientBillingState.POSTED,
          productId: { not: null },
          client: clientScope,
        },
        select: { clientId: true, productId: true, updatedAt: true },
      }),
      this.prisma.marketingClientProduct.findMany({
        where: {
          tenantId,
          status: MarketingClientProductStatus.PURCHASED,
          client: clientScope,
        },
        select: { clientId: true, productId: true, expectedValue: true },
      }),
    ]);

    const firstPosted = new Map<string, Date>();
    for (const billing of billings) {
      const key = `${billing.clientId}:${billing.productId}`;
      const known = firstPosted.get(key);
      if (!known || billing.updatedAt < known) {
        firstPosted.set(key, billing.updatedAt);
      }
    }

    const deals: { at: Date; value: Prisma.Decimal }[] = [];
    for (const product of purchased) {
      const at = firstPosted.get(`${product.clientId}:${product.productId}`);
      if (!at) continue;
      deals.push({
        at,
        value: product.expectedValue
          ? new Prisma.Decimal(product.expectedValue)
          : ZERO,
      });
    }
    return deals;
  }

  /** Value of deals not yet won whose expected close date falls in the range. */
  private async expectedClosing(
    tenantId: string,
    prospectScope: { assignedUserId?: string },
    clientScope: { assignedUserId?: string },
    range: Range,
  ) {
    const expectedCloseDate = { gte: range.from, lt: range.to };
    const [fromClients, fromProspects] = await Promise.all([
      this.prisma.marketingClientProduct.aggregate({
        _sum: { expectedValue: true },
        where: {
          tenantId,
          status: MarketingClientProductStatus.PENDING,
          expectedCloseDate,
          client: clientScope,
        },
      }),
      // A converted prospect's products continue as client products, so only unconverted ones count here.
      this.prisma.marketingProspectProduct.aggregate({
        _sum: { expectedValue: true },
        where: {
          tenantId,
          expectedCloseDate,
          prospect: { ...prospectScope, client: { is: null } },
        },
      }),
    ]);
    return new Prisma.Decimal(fromClients._sum.expectedValue ?? 0).plus(
      fromProspects._sum.expectedValue ?? 0,
    );
  }

  /**
   * Open prospects (not yet clients) created in the range, by pipeline stage: how many there
   * are, what they are expected to bring in, and the average per prospect.
   */
  private async pipeline(
    tenantId: string,
    prospectScope: { assignedUserId?: string },
    range: Range,
  ) {
    const open: Prisma.MarketingProspectWhereInput = {
      tenantId,
      ...prospectScope,
      client: { is: null },
      createdAt: { gte: range.from, lt: range.to },
    };
    const [stages, counts, products] = await Promise.all([
      this.prisma.marketingPipelineStage.findMany({
        where: { tenantId, isActive: true },
        orderBy: { displayOrder: 'asc' },
      }),
      this.prisma.marketingProspect.groupBy({
        by: ['pipelineStageId'],
        where: open,
        _count: { _all: true },
      }),
      this.prisma.marketingProspectProduct.findMany({
        where: { tenantId, prospect: open },
        select: {
          expectedValue: true,
          prospect: { select: { pipelineStageId: true } },
        },
      }),
    ]);

    const countByStage = new Map(
      counts.map((row) => [row.pipelineStageId, row._count._all]),
    );
    const expectedByStage = new Map<string, Prisma.Decimal>();
    for (const product of products) {
      const id = product.prospect.pipelineStageId;
      expectedByStage.set(
        id,
        (expectedByStage.get(id) ?? ZERO).plus(product.expectedValue),
      );
    }

    let totalProspects = 0;
    let totalExpected = ZERO;
    const rows: DashboardStage[] = stages.map((stage) => {
      const prospects = countByStage.get(stage.id) ?? 0;
      const expected = expectedByStage.get(stage.id) ?? ZERO;
      totalProspects += prospects;
      totalExpected = totalExpected.plus(expected);
      return {
        stageId: stage.id,
        name: stage.name,
        probability: stage.probability,
        prospects,
        expected: money(expected),
        average: money(prospects > 0 ? expected.div(prospects) : ZERO),
      };
    });

    return {
      stages: rows,
      prospects: totalProspects,
      expected: money(totalExpected),
    };
  }

  private async clientCounts(
    tenantId: string,
    scope: { assignedUserId?: string },
    range: Range,
  ) {
    const where: Prisma.MarketingClientWhereInput = { tenantId, ...scope };
    const [total, created, billable] = await Promise.all([
      this.prisma.marketingClient.count({ where }),
      this.prisma.marketingClient.count({
        where: { ...where, createdAt: { gte: range.from, lt: range.to } },
      }),
      this.prisma.marketingClient.count({
        where: { ...where, isBillable: true },
      }),
    ]);
    return { total, new: created, billable, nonBillable: total - billable };
  }

  /** Invoices raised for the in-scope clients in each range. */
  private async achievedRevenue(
    user: RequestUser,
    clientScope: { assignedUserId?: string },
    days: DayRange,
    prevDays: DayRange,
  ) {
    const [invoices, currency] = await Promise.all([
      this.targets.invoiceRows(user.tenantId, clientScope),
      this.targets.baseCurrency(user),
    ]);
    return {
      current: money(sumInvoiced(invoices, days)),
      previous: money(sumInvoiced(invoices, prevDays)),
      currency,
    };
  }

  /**
   * Targets running during the period, added up. A rep's all-products target already includes
   * their product targets, so a rep with one counts only that; otherwise their product targets add up.
   */
  private async targetProgress(user: RequestUser, days: DayRange) {
    const rows = await this.targets.listOverlapping(user, days.from, days.to);
    const byRep = new Map<string, typeof rows>();
    for (const row of rows) {
      byRep.set(row.userId, [...(byRep.get(row.userId) ?? []), row]);
    }

    let target = ZERO;
    let achieved: Prisma.Decimal | null = ZERO;
    let count = 0;
    for (const repRows of byRep.values()) {
      const totals = repRows.filter((row) => !row.productId);
      const counted = totals.length > 0 ? totals : repRows;
      for (const row of counted) {
        count += 1;
        target = target.plus(row.amount);
        achieved =
          achieved && row.achieved !== null
            ? achieved.plus(row.achieved)
            : null;
      }
    }

    return {
      count,
      target: money(target),
      achieved: achieved ? money(achieved) : null,
      remaining: achieved
        ? money(Prisma.Decimal.max(target.minus(achieved), 0))
        : null,
      percent:
        achieved && target.greaterThan(0)
          ? achieved.div(target).times(100).toDecimalPlaces(1).toNumber()
          : null,
    };
  }
}
