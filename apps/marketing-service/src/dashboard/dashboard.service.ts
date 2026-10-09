import { Injectable, Logger } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingClientBillingState,
  MarketingClientProductStatus,
  Prisma,
} from '../../prisma/generated/client';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { PrismaService } from '../prisma/prisma.service';
import { SalesTargetsService } from '../sales-targets/sales-targets.service';
import {
  DashboardStage,
  DashboardSummary,
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
      this.pipeline(user.tenantId, prospectScope),
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

  /** Open prospects (not yet clients) by pipeline stage, now. Weighted by the stage's probability. */
  private async pipeline(
    tenantId: string,
    prospectScope: { assignedUserId?: string },
  ) {
    const open: Prisma.MarketingProspectWhereInput = {
      tenantId,
      ...prospectScope,
      client: { is: null },
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
    let totalWeighted = ZERO;
    const rows: DashboardStage[] = stages.map((stage) => {
      const prospects = countByStage.get(stage.id) ?? 0;
      const expected = expectedByStage.get(stage.id) ?? ZERO;
      const weighted = expected.times(stage.probability).div(100);
      totalProspects += prospects;
      totalExpected = totalExpected.plus(expected);
      totalWeighted = totalWeighted.plus(weighted);
      return {
        stageId: stage.id,
        name: stage.name,
        probability: stage.probability,
        prospects,
        expected: money(expected),
        weighted: money(weighted),
      };
    });

    return {
      stages: rows,
      prospects: totalProspects,
      expected: money(totalExpected),
      weighted: money(totalWeighted),
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

  /** Money Accounting received from the in-scope clients in each range; null if Accounting is down. */
  private async achievedRevenue(
    user: RequestUser,
    clientScope: { assignedUserId?: string },
    days: DayRange,
    prevDays: DayRange,
  ) {
    const clients = await this.prisma.marketingClient.findMany({
      where: {
        tenantId: user.tenantId,
        ...clientScope,
        accountingEntityId: { not: null },
      },
      select: { accountingEntityId: true },
    });
    const entityIds = clients
      .map((client) => client.accountingEntityId)
      .filter((id): id is string => Boolean(id));
    if (entityIds.length === 0) {
      return { current: money(ZERO), previous: money(ZERO), currency: null };
    }

    try {
      const [now, before] = await Promise.all([
        this.targets.receivedByEntities(user, entityIds, days),
        this.targets.receivedByEntities(user, entityIds, prevDays),
      ]);
      return {
        current: now.amount,
        previous: before.amount,
        currency: now.currency || before.currency || null,
      };
    } catch (error) {
      this.logger.warn(
        `achieved revenue unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return { current: null, previous: null, currency: null };
    }
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
