import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingClientProductStatus,
  Prisma,
} from '../../prisma/generated/client';
import { AssigneesService } from '../assignees/assignees.service';
import { toRange } from '../dashboard/range';
import { DirectoryPerson, HrDirectoryClient } from '../hr/hr-directory.client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesTargetsService } from '../sales-targets/sales-targets.service';
import {
  QueryTargetReportDto,
  TargetReport,
  TargetReportFilters,
  TargetReportRow,
} from './dto/target-report.dto';

const ZERO = new Prisma.Decimal(0);
const money = (value: Prisma.Decimal) => value.toFixed(2);
const NOT_FOUND_MESSAGE = 'Sales rep not found';

type TargetRow = {
  userId: string;
  productId: string | null;
  amount: string;
  achieved: string | null;
};

/**
 * Each sales rep's yearly target against what they have achieved, with the pipeline still to
 * come. Scoped like the targets list: without the view-all targets permission a caller only sees
 * themselves, and the team totals are for those who may see everyone.
 */
@Injectable()
export class TargetReportService {
  private readonly logger = new Logger(TargetReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly targets: SalesTargetsService,
    private readonly assignees: AssigneesService,
    private readonly hr: HrDirectoryClient,
  ) {}

  async report(
    user: RequestUser,
    query: QueryTargetReportDto,
  ): Promise<TargetReport> {
    const canViewTeam = this.targets.canViewAll(user);
    if (query.userId && query.userId !== user.id && !canViewTeam) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    const from = `${query.year}-01-01`;
    const to = `${query.year}-12-31`;
    const rows = await this.targets.listOverlapping(user, from, to);
    const byRep = new Map<string, TargetRow[]>();
    for (const row of rows) {
      if (query.userId && row.userId !== query.userId) continue;
      byRep.set(row.userId, [...(byRep.get(row.userId) ?? []), row]);
    }

    // Branch and department live with HR; only asked for when the report is narrowed by them or
    // to name them. If HR is unreachable the report still works, without those columns.
    const people = await this.people(user.tenantId, [...byRep.keys()]);
    const wantsOrg = Boolean(query.branchId || query.departmentId);
    const repIds = [...byRep.keys()].filter((id) => {
      const person = people.get(id);
      if (query.branchId && person?.branchId !== query.branchId) return false;
      if (query.departmentId && person?.departmentId !== query.departmentId)
        return false;
      return !wantsOrg || Boolean(person);
    });

    const [names, expected, currency] = await Promise.all([
      this.assignees.namesFor(user.tenantId, repIds),
      this.expectedByRep(user.tenantId, repIds, query.year),
      this.targets.baseCurrency(user),
    ]);

    const reps: TargetReportRow[] = repIds
      .map((userId) => {
        const figures = this.figures(byRep.get(userId) ?? []);
        return {
          userId,
          name: names.get(userId) ?? 'Unknown rep',
          branch: people.get(userId)?.branch ?? null,
          department: people.get(userId)?.department ?? null,
          ...this.row(figures.target, figures.achieved, expected.get(userId)),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      year: query.year,
      currency,
      canViewTeam,
      reps,
      totals: canViewTeam ? this.totals(reps) : null,
    };
  }

  /** What the filters can offer this caller: everyone's options for team viewers, else themselves. */
  async filters(user: RequestUser): Promise<TargetReportFilters> {
    const canViewTeam = this.targets.canViewAll(user);
    const [active, people] = await Promise.all([
      this.assignees.activeUsers(user.tenantId),
      this.people(user.tenantId),
    ]);
    const reps = active
      .filter((rep) => canViewTeam || rep.userId === user.id)
      .map(({ userId, name }) => ({ userId, name }));

    const branches = new Map<string, string>();
    const departments = new Map<string, string>();
    for (const person of canViewTeam ? people.values() : []) {
      if (person.branchId && person.branch)
        branches.set(person.branchId, person.branch);
      if (person.departmentId && person.department)
        departments.set(person.departmentId, person.department);
    }
    const sorted = (map: Map<string, string>) =>
      [...map.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return {
      reps,
      branches: sorted(branches),
      departments: sorted(departments),
    };
  }

  /**
   * A rep's target is their overall target when they have one, otherwise the sum of their
   * per-product ones. Achieved is null as soon as a counted target's figure is unavailable.
   */
  private figures(rows: TargetRow[]) {
    const totals = rows.filter((row) => !row.productId);
    const counted = totals.length > 0 ? totals : rows;
    let target = ZERO;
    let achieved: Prisma.Decimal | null = ZERO;
    for (const row of counted) {
      target = target.plus(row.amount);
      achieved =
        achieved && row.achieved !== null ? achieved.plus(row.achieved) : null;
    }
    return { target, achieved };
  }

  private row(
    target: Prisma.Decimal,
    achieved: Prisma.Decimal | null,
    expected: Prisma.Decimal = ZERO,
  ) {
    return {
      target: money(target),
      achieved: achieved ? money(achieved) : null,
      remaining: achieved
        ? money(Prisma.Decimal.max(target.minus(achieved), 0))
        : null,
      percent:
        achieved && target.gt(0)
          ? Math.round(achieved.div(target).times(1000).toNumber()) / 10
          : null,
      expected: money(expected),
    };
  }

  private totals(reps: TargetReportRow[]) {
    let target = ZERO;
    let expected = ZERO;
    let achieved: Prisma.Decimal | null = ZERO;
    for (const rep of reps) {
      target = target.plus(rep.target);
      expected = expected.plus(rep.expected);
      achieved =
        achieved && rep.achieved !== null ? achieved.plus(rep.achieved) : null;
    }
    return this.row(target, achieved, expected);
  }

  /** Deals not yet won whose expected close date falls in the year, per rep. */
  private async expectedByRep(
    tenantId: string,
    userIds: string[],
    year: number,
  ) {
    const expected = new Map<string, Prisma.Decimal>();
    if (userIds.length === 0) return expected;
    const range = toRange(`${year}-01-01`, `${year}-12-31`);
    const expectedCloseDate = { gte: range.from, lt: range.to };

    const [clientProducts, prospectProducts] = await Promise.all([
      this.prisma.marketingClientProduct.findMany({
        where: {
          tenantId,
          status: MarketingClientProductStatus.PENDING,
          expectedCloseDate,
          client: { assignedUserId: { in: userIds } },
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
          prospect: { assignedUserId: { in: userIds }, client: { is: null } },
        },
        select: {
          expectedValue: true,
          prospect: { select: { assignedUserId: true } },
        },
      }),
    ]);

    const add = (userId: string, value: Prisma.Decimal | null) => {
      if (value)
        expected.set(userId, (expected.get(userId) ?? ZERO).plus(value));
    };
    for (const row of clientProducts)
      add(row.client.assignedUserId, row.expectedValue);
    for (const row of prospectProducts)
      add(row.prospect.assignedUserId, row.expectedValue);
    return expected;
  }

  /** Employee details by login account. Empty when HR cannot be reached. */
  private async people(tenantId: string, userIds?: string[]) {
    const byUser = new Map<string, DirectoryPerson>();
    try {
      for (const person of await this.hr.list(tenantId)) {
        if (person.userId && (!userIds || userIds.includes(person.userId))) {
          byUser.set(person.userId, person);
        }
      }
    } catch (error) {
      this.logger.warn(
        `employee directory unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
    return byUser;
  }
}
