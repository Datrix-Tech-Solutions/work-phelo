import { Injectable } from '@nestjs/common';
import {
  GLAccountCategory,
  JournalStatus,
  NormalBalance,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  daysBetween,
  dueDateFor,
  latestCompletedPeriod,
  remindFrom,
} from './tax-obligations';

const zero = new Prisma.Decimal(0);

const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

@Injectable()
export class TaxObligationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The taxes that are due to be paid and still owe something, for the payment reminders.
   *
   * What is owed is read from the ledger, on the tax type's payable account: what had built up by the
   * end of the last finished period, less what has been paid down since. So a payment counts however it
   * was booked (a cashbook payment, a journal), and nothing has to be ticked off. Only posted entries
   * count, and an entry that was later reversed does not count as a payment.
   */
  async listObligations(tenantId: string, now: Date = new Date()) {
    const config = await this.prisma.accountingTenantConfig.findUnique({
      where: { tenantId },
    });
    if (!config) return [];

    const taxTypes = await this.findLiabilityTaxTypes(tenantId, true);
    const obligations = [];
    for (const taxType of taxTypes) {
      const schedule = this.scheduleOf(taxType);
      const period = latestCompletedPeriod(
        taxType.reminderFrequency,
        now,
        config.fiscalYearStartMonth,
      );
      const due = dueDateFor(period.end, schedule);
      if (daysBetween(remindFrom(due, schedule), now) < 0) continue;

      const outstanding = await this.outstandingForPeriod(
        tenantId,
        taxType.payableAccount,
        period.end,
        now,
      );
      if (!outstanding.greaterThan(zero)) continue;

      obligations.push({
        taxTypeId: taxType.id,
        code: taxType.code,
        name: taxType.name,
        periodStart: isoDate(period.start),
        periodEnd: isoDate(period.end),
        dueDate: isoDate(due),
        daysUntil: daysBetween(now, due),
        amountOutstanding: outstanding.toFixed(2),
        currency: config.baseCurrency,
      });
    }
    return obligations;
  }

  /**
   * What each tax owes right now, for the payment form to fill in. A tax with a reminder owes what is
   * unpaid for its last finished period; any other owes what its payable account holds.
   */
  async listOutstanding(tenantId: string, now: Date = new Date()) {
    const config = await this.prisma.accountingTenantConfig.findUnique({
      where: { tenantId },
    });
    if (!config) return [];

    const taxTypes = await this.findLiabilityTaxTypes(tenantId, false);
    const rows = [];
    for (const taxType of taxTypes) {
      const account = taxType.payableAccount;
      let outstanding: Prisma.Decimal;
      let dueDate: string | null = null;
      if (taxType.reminderEnabled) {
        const period = latestCompletedPeriod(
          taxType.reminderFrequency,
          now,
          config.fiscalYearStartMonth,
        );
        dueDate = isoDate(dueDateFor(period.end, this.scheduleOf(taxType)));
        outstanding = await this.outstandingForPeriod(
          tenantId,
          account,
          period.end,
          now,
        );
      } else {
        outstanding = await this.owedAtPeriodEnd(
          tenantId,
          account.id,
          account.normalBalance,
          now,
        );
      }
      rows.push({
        taxTypeId: taxType.id,
        code: taxType.code,
        name: taxType.name,
        payableAccountId: account.id,
        dueDate,
        amountOutstanding: (outstanding.greaterThan(zero)
          ? outstanding
          : zero
        ).toFixed(2),
        currency: config.baseCurrency,
      });
    }
    return rows;
  }

  /** Active taxes whose payable account is a liability, the only kind that builds up an amount to pay. */
  private async findLiabilityTaxTypes(
    tenantId: string,
    remindersOnly: boolean,
  ) {
    const taxTypes = await this.prisma.taxType.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(remindersOnly ? { reminderEnabled: true } : {}),
        payableAccountId: { not: null },
      },
      include: { payableAccount: true },
      orderBy: { name: 'asc' },
    });
    return taxTypes.flatMap((taxType) =>
      taxType.payableAccount &&
      taxType.payableAccount.category === GLAccountCategory.LIABILITY
        ? [{ ...taxType, payableAccount: taxType.payableAccount }]
        : [],
    );
  }

  private scheduleOf(taxType: {
    reminderDueDay: number | null;
    reminderDueOnLastDay: boolean;
    reminderDaysBefore: number;
  }) {
    return {
      dueDay: taxType.reminderDueDay,
      dueOnLastDay: taxType.reminderDueOnLastDay,
      daysBefore: taxType.reminderDaysBefore,
    };
  }

  private async outstandingForPeriod(
    tenantId: string,
    account: { id: string; normalBalance: NormalBalance },
    periodEnd: Date,
    now: Date,
  ) {
    const owed = await this.owedAtPeriodEnd(
      tenantId,
      account.id,
      account.normalBalance,
      periodEnd,
    );
    const paid = await this.paidSince(
      tenantId,
      account.id,
      account.normalBalance,
      periodEnd,
      now,
    );
    return owed.minus(paid);
  }

  /** The side of the account that a payment lowers, and the side that builds it up. */
  private sides(normalBalance: NormalBalance) {
    return normalBalance === NormalBalance.CREDIT
      ? { up: 'baseCredit', down: 'baseDebit' }
      : { up: 'baseDebit', down: 'baseCredit' };
  }

  private async owedAtPeriodEnd(
    tenantId: string,
    accountId: string,
    normalBalance: NormalBalance,
    periodEnd: Date,
  ) {
    const { up, down } = this.sides(normalBalance);
    const total = await this.prisma.journalLine.aggregate({
      where: {
        tenantId,
        glAccountId: accountId,
        journalEntry: {
          tenantId,
          // A reversed entry is cancelled out by its own reversal, so both count.
          status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
          transactionDate: { lte: endOfDay(periodEnd) },
        },
      },
      _sum: { baseDebit: true, baseCredit: true },
    });
    return (total._sum[up as 'baseCredit'] ?? zero).minus(
      total._sum[down as 'baseDebit'] ?? zero,
    );
  }

  private async paidSince(
    tenantId: string,
    accountId: string,
    normalBalance: NormalBalance,
    periodEnd: Date,
    now: Date,
  ) {
    const { down } = this.sides(normalBalance);
    const total = await this.prisma.journalLine.aggregate({
      where: {
        tenantId,
        glAccountId: accountId,
        journalEntry: {
          tenantId,
          // Not REVERSED: a payment that was taken back is not a payment.
          status: JournalStatus.POSTED,
          transactionDate: { gt: endOfDay(periodEnd), lte: endOfDay(now) },
        },
      },
      _sum: { baseDebit: true, baseCredit: true },
    });
    return total._sum[down as 'baseDebit'] ?? zero;
  }
}
