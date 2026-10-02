import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  BudgetScope,
  BudgetStatus,
  GLAccountCategory,
  JournalStatus,
  Prisma,
  RecordStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  budgetEndDate,
  dayAfter,
  parseBudgetDate,
  toDateOnly,
} from './budget-period';
import {
  BudgetLineDto,
  CreateBudgetDto,
  QueryBudgetsDto,
  UpdateBudgetDto,
} from './dto/budgets.dto';

const budgetInclude = {
  lines: {
    include: {
      glAccount: {
        select: { id: true, code: true, name: true, category: true },
      },
      costCentre: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.BudgetInclude;

type BudgetWithLines = Prisma.BudgetGetPayload<{
  include: typeof budgetInclude;
}>;

interface NormalizedLine {
  accountId: string;
  costCentreId: string | null;
  amount: number;
}

/** The GL account categories each scope draws its lines from. */
const SCOPE_CATEGORIES: Record<BudgetScope, GLAccountCategory[]> = {
  EXPENSE: [GLAccountCategory.EXPENSE],
  INCOME: [GLAccountCategory.REVENUE],
  BOTH: [GLAccountCategory.EXPENSE, GLAccountCategory.REVENUE],
};

// Same basis as the income statement: reversed journals stay in so their reversal nets them out.
const ACTUAL_JOURNAL_STATUSES = [JournalStatus.POSTED, JournalStatus.REVERSED];

const zero = new Prisma.Decimal(0);

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: QueryBudgetsDto) {
    const budgets = await this.prisma.budget.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? { name: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      include: budgetInclude,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return budgets.map((budget) => this.toBudget(budget));
  }

  async get(tenantId: string, budgetId: string) {
    const budget = await this.getOrThrow(tenantId, budgetId);
    return this.toDetail(budget, await this.actuals(tenantId, budget));
  }

  async create(user: RequestUser, dto: CreateBudgetDto) {
    const config = await this.prisma.accountingTenantConfig.findUnique({
      where: { tenantId: user.tenantId },
    });
    if (!config) {
      throw new BadRequestException(
        'Accounting tenant configuration is required before creating budgets',
      );
    }

    const startDate = this.parseStart(dto.startDate);
    const lines = this.normalizeLines(dto.lines);
    await this.validateLines(user.tenantId, dto.scope, lines);

    const budgetId = await this.prisma.$transaction(async (tx) => {
      const budget = await tx.budget.create({
        data: {
          tenantId: user.tenantId,
          name: dto.name,
          period: dto.period,
          scope: dto.scope,
          startDate,
          endDate: budgetEndDate(dto.period, startDate),
          currency: config.baseCurrency,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      await tx.budgetLine.createMany({
        data: this.lineRows(user.tenantId, budget.id, lines),
      });
      return budget.id;
    });

    await this.recordAudit(user, 'BUDGET_CREATED', budgetId, {
      name: dto.name,
      lines: lines.length,
    });
    return this.get(user.tenantId, budgetId);
  }

  async update(user: RequestUser, budgetId: string, dto: UpdateBudgetDto) {
    const existing = await this.getOrThrow(user.tenantId, budgetId);
    if (existing.status === BudgetStatus.CLOSED) {
      throw new ConflictException('A closed budget cannot be edited');
    }

    const period = dto.period ?? existing.period;
    const scope = dto.scope ?? existing.scope;
    const startDate = dto.startDate
      ? this.parseStart(dto.startDate)
      : existing.startDate;
    const lines = dto.lines
      ? this.normalizeLines(dto.lines)
      : existing.lines.map((line) => ({
          accountId: line.glAccountId,
          costCentreId: line.costCentreId,
          amount: Number(line.amount.toString()),
        }));

    // Accounts / cost centres the budget already uses stay valid even if deactivated since —
    // otherwise an unrelated edit would be blocked by an old line.
    await this.validateLines(user.tenantId, scope, lines, {
      accountIds: new Set(existing.lines.map((l) => l.glAccountId)),
      costCentreIds: new Set(
        existing.lines.flatMap((l) => (l.costCentreId ? [l.costCentreId] : [])),
      ),
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.budget.update({
        where: { id_tenantId: { id: budgetId, tenantId: user.tenantId } },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          period,
          scope,
          startDate,
          endDate: budgetEndDate(period, startDate),
          updatedByUserId: user.id,
        },
      });
      if (dto.lines) {
        await tx.budgetLine.deleteMany({
          where: { tenantId: user.tenantId, budgetId },
        });
        await tx.budgetLine.createMany({
          data: this.lineRows(user.tenantId, budgetId, lines),
        });
      }
    });

    await this.recordAudit(user, 'BUDGET_UPDATED', budgetId, {
      fields: Object.keys(dto),
    });
    return this.get(user.tenantId, budgetId);
  }

  async activate(user: RequestUser, budgetId: string) {
    return this.transition(
      user,
      budgetId,
      BudgetStatus.DRAFT,
      BudgetStatus.ACTIVE,
      'BUDGET_ACTIVATED',
      'Only a draft budget can be activated',
    );
  }

  async close(user: RequestUser, budgetId: string) {
    return this.transition(
      user,
      budgetId,
      BudgetStatus.ACTIVE,
      BudgetStatus.CLOSED,
      'BUDGET_CLOSED',
      'Only an active budget can be closed',
    );
  }

  async remove(user: RequestUser, budgetId: string) {
    const budget = await this.getOrThrow(user.tenantId, budgetId);
    if (budget.status !== BudgetStatus.DRAFT) {
      throw new ConflictException('Only a draft budget can be deleted');
    }
    await this.prisma.budget.delete({
      where: { id_tenantId: { id: budgetId, tenantId: user.tenantId } },
    });
    await this.recordAudit(user, 'BUDGET_DELETED', budgetId, {
      name: budget.name,
    });
  }

  private async transition(
    user: RequestUser,
    budgetId: string,
    from: BudgetStatus,
    to: BudgetStatus,
    action: string,
    conflictMessage: string,
  ) {
    const budget = await this.getOrThrow(user.tenantId, budgetId);
    if (budget.status !== from) throw new ConflictException(conflictMessage);

    // Guarded on the current status so two concurrent requests cannot both win.
    const claimed = await this.prisma.budget.updateMany({
      where: { id: budgetId, tenantId: user.tenantId, status: from },
      data: {
        status: to,
        updatedByUserId: user.id,
        ...(to === BudgetStatus.ACTIVE ? { activatedAt: new Date() } : {}),
        ...(to === BudgetStatus.CLOSED ? { closedAt: new Date() } : {}),
      },
    });
    if (claimed.count !== 1) throw new ConflictException(conflictMessage);

    await this.recordAudit(user, action, budgetId, { from, to });
    return this.get(user.tenantId, budgetId);
  }

  private async getOrThrow(tenantId: string, budgetId: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, tenantId },
      include: budgetInclude,
    });
    if (!budget) throw new NotFoundException('Budget not found');
    return budget;
  }

  private parseStart(value: string) {
    const date = parseBudgetDate(value);
    if (!date) throw new BadRequestException('startDate is not a valid date');
    return date;
  }

  private normalizeLines(lines: BudgetLineDto[]): NormalizedLine[] {
    return lines.map((line) => ({
      accountId: line.accountId,
      costCentreId: line.costCentreId ?? null,
      amount: line.amount,
    }));
  }

  private lineRows(
    tenantId: string,
    budgetId: string,
    lines: NormalizedLine[],
  ): Prisma.BudgetLineCreateManyInput[] {
    return lines.map((line) => ({
      tenantId,
      budgetId,
      glAccountId: line.accountId,
      costCentreId: line.costCentreId,
      amount: new Prisma.Decimal(line.amount),
    }));
  }

  /**
   * A line must sit on an active leaf posting account whose category fits the budget scope,
   * and any cost centre must be active. An account is either one company-wide line or split
   * across cost centres — never both, and never the same cost centre twice. `existing` names
   * accounts / cost centres already on the budget, which are exempt from the active check.
   */
  private async validateLines(
    tenantId: string,
    scope: BudgetScope,
    lines: NormalizedLine[],
    existing?: { accountIds: Set<string>; costCentreIds: Set<string> },
  ) {
    if (lines.length === 0) {
      throw new BadRequestException('A budget needs at least one line');
    }
    const seen = new Set<string>();
    for (const line of lines) {
      const key = `${line.accountId}:${line.costCentreId ?? ''}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          'A budget cannot list the same account and cost centre twice',
        );
      }
      seen.add(key);
    }

    const accountIds = [...new Set(lines.map((l) => l.accountId))];
    const costCentreIds = [
      ...new Set(
        lines.flatMap((l) => (l.costCentreId ? [l.costCentreId] : [])),
      ),
    ];
    const [accounts, costCentres] = await Promise.all([
      this.prisma.gLAccount.findMany({
        where: { tenantId, id: { in: accountIds } },
        include: { _count: { select: { childAccounts: true } } },
      }),
      costCentreIds.length
        ? this.prisma.costCentre.findMany({
            where: { tenantId, id: { in: costCentreIds } },
          })
        : Promise.resolve([]),
    ]);

    if (accounts.length !== accountIds.length) {
      throw new BadRequestException(
        'One or more GL accounts do not belong to this tenant',
      );
    }
    const categories = SCOPE_CATEGORIES[scope];
    for (const account of accounts) {
      const label = `${account.code} – ${account.name}`;
      if (!account.allowPosting || account._count.childAccounts > 0) {
        throw new BadRequestException(
          `${label} is not a posting account — budget its leaf accounts instead`,
        );
      }
      if (
        account.status !== RecordStatus.ACTIVE &&
        !existing?.accountIds.has(account.id)
      ) {
        throw new BadRequestException(`${label} is inactive`);
      }
      if (!categories.includes(account.category)) {
        throw new BadRequestException(
          `${label} is a ${account.category.toLowerCase()} account and does not fit an ${scope.toLowerCase()} budget`,
        );
      }
    }

    if (costCentres.length !== costCentreIds.length) {
      throw new BadRequestException(
        'One or more cost centres do not belong to this tenant',
      );
    }
    for (const costCentre of costCentres) {
      if (
        costCentre.status !== RecordStatus.ACTIVE &&
        !existing?.costCentreIds.has(costCentre.id)
      ) {
        throw new BadRequestException(
          `Cost centre ${costCentre.code} – ${costCentre.name} is inactive`,
        );
      }
    }

    const labels = new Map(
      accounts.map((a) => [a.id, `${a.code} – ${a.name}`]),
    );
    const byAccount = new Map<string, NormalizedLine[]>();
    for (const line of lines) {
      byAccount.set(line.accountId, [
        ...(byAccount.get(line.accountId) ?? []),
        line,
      ]);
    }
    for (const [accountId, group] of byAccount) {
      if (group.length > 1 && group.some((l) => l.costCentreId === null)) {
        throw new BadRequestException(
          `${labels.get(accountId)}: give every line a cost centre, or keep a single company-wide line`,
        );
      }
    }
  }

  /**
   * Posted activity inside the budget window per account and cost centre, in base currency.
   * A cost-centre line reads only that cost centre; a company-wide line reads the account's
   * activity across all cost centres. Null when nothing has posted yet.
   */
  private async actuals(tenantId: string, budget: BudgetWithLines) {
    const result = new Map<string, number | null>();
    const accountIds = [...new Set(budget.lines.map((l) => l.glAccountId))];
    const rows = accountIds.length
      ? await this.prisma.journalLine.groupBy({
          by: ['glAccountId', 'costCentreId'],
          where: {
            tenantId,
            glAccountId: { in: accountIds },
            journalEntry: {
              tenantId,
              status: { in: ACTUAL_JOURNAL_STATUSES },
              transactionDate: {
                gte: budget.startDate,
                lt: dayAfter(budget.endDate),
              },
            },
          },
          _sum: { baseDebit: true, baseCredit: true },
        })
      : [];

    for (const line of budget.lines) {
      const matching = rows.filter(
        (row) =>
          row.glAccountId === line.glAccountId &&
          (line.costCentreId === null ||
            row.costCentreId === line.costCentreId),
      );
      let debit = zero;
      let credit = zero;
      for (const row of matching) {
        debit = debit.plus(row._sum.baseDebit ?? zero);
        credit = credit.plus(row._sum.baseCredit ?? zero);
      }
      const actual =
        line.glAccount.category === GLAccountCategory.REVENUE
          ? credit.minus(debit)
          : debit.minus(credit);
      result.set(
        this.lineKey(line),
        matching.length ? actual.toDecimalPlaces(2).toNumber() : null,
      );
    }
    return result;
  }

  private lineKey(line: { glAccountId: string; costCentreId: string | null }) {
    return `${line.glAccountId}:${line.costCentreId ?? ''}`;
  }

  private toBudget(budget: BudgetWithLines) {
    let income = zero;
    let expense = zero;
    for (const line of budget.lines) {
      if (line.glAccount.category === GLAccountCategory.REVENUE) {
        income = income.plus(line.amount);
      } else {
        expense = expense.plus(line.amount);
      }
    }
    return {
      id: budget.id,
      name: budget.name,
      period: budget.period,
      scope: budget.scope,
      startDate: toDateOnly(budget.startDate),
      endDate: toDateOnly(budget.endDate),
      currency: budget.currency,
      incomeBudgeted: income.toNumber(),
      expenseBudgeted: expense.toNumber(),
      netAmount: income.minus(expense).toNumber(),
      status: budget.status,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }

  private toDetail(
    budget: BudgetWithLines,
    actuals: Map<string, number | null>,
  ) {
    const lines = [...budget.lines]
      .sort(
        (a, b) =>
          a.glAccount.code.localeCompare(b.glAccount.code) ||
          (a.costCentre?.code ?? '').localeCompare(b.costCentre?.code ?? ''),
      )
      .map((line) => ({
        accountId: line.glAccountId,
        accountCode: line.glAccount.code,
        accountName: line.glAccount.name,
        category: line.glAccount.category,
        costCentreId: line.costCentreId,
        costCentreCode: line.costCentre?.code ?? null,
        costCentreName: line.costCentre?.name ?? null,
        budgeted: line.amount.toNumber(),
        actual: actuals.get(this.lineKey(line)) ?? null,
      }));
    return { ...this.toBudget(budget), lines };
  }

  private async recordAudit(
    user: RequestUser,
    action: string,
    entityId: string,
    changedFields: unknown,
  ) {
    await this.prisma.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action,
        entityType: 'Budget',
        entityId,
        changedFields: JSON.parse(
          JSON.stringify(changedFields ?? {}),
        ) as Prisma.InputJsonValue,
      },
    });
  }
}
