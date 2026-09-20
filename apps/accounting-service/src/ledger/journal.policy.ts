import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';

export interface JournalAmountLine {
  debit?: number | string | Prisma.Decimal;
  credit?: number | string | Prisma.Decimal;
}

@Injectable()
export class JournalPolicy {
  validateBalanced(lines: JournalAmountLine[]): void {
    if (lines.length < 2) {
      throw new BadRequestException(
        'A journal must contain at least two lines',
      );
    }

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    for (const [index, line] of lines.entries()) {
      const debit = new Prisma.Decimal(line.debit ?? 0);
      const credit = new Prisma.Decimal(line.credit ?? 0);
      if (debit.isNegative() || credit.isNegative()) {
        throw new BadRequestException(
          `Journal line ${index + 1} cannot contain negative amounts`,
        );
      }
      const hasDebit = debit.greaterThan(0);
      const hasCredit = credit.greaterThan(0);
      if (hasDebit === hasCredit) {
        throw new BadRequestException(
          `Journal line ${index + 1} must contain either a debit or a credit`,
        );
      }
      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);
    }

    if (totalDebit.isZero() || !totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `Journal is unbalanced: debit ${totalDebit.toFixed(2)} does not equal credit ${totalCredit.toFixed(2)}`,
      );
    }
  }

  baseAmount(
    amount: number | string | Prisma.Decimal,
    exchangeRate: number | string | Prisma.Decimal,
    decimalPlaces: number,
  ): Prisma.Decimal {
    return new Prisma.Decimal(amount)
      .times(exchangeRate)
      .toDecimalPlaces(decimalPlaces, Prisma.Decimal.ROUND_HALF_UP);
  }

  /**
   * Base-currency debit/credit for each line. Converting each line and rounding it can leave
   * the base totals a cent or so apart even though the transaction-currency totals match. That
   * rounding difference (bounded by half a unit of the last decimal per line) is absorbed by
   * the largest line on the heavier side, so a journal that balances in its own currency is
   * never rejected in base. A genuine imbalance is left alone for `validateBalanced` to catch.
   */
  allocateBaseAmounts(
    lines: JournalAmountLine[],
    exchangeRate: number | string | Prisma.Decimal,
    decimalPlaces: number,
  ): Array<{ debit: Prisma.Decimal; credit: Prisma.Decimal }> {
    const base = lines.map((line) => ({
      debit: this.baseAmount(line.debit ?? 0, exchangeRate, decimalPlaces),
      credit: this.baseAmount(line.credit ?? 0, exchangeRate, decimalPlaces),
    }));
    const sum = (side: 'debit' | 'credit') =>
      base.reduce(
        (total, line) => total.plus(line[side]),
        new Prisma.Decimal(0),
      );
    const diff = sum('debit').minus(sum('credit'));
    if (diff.isZero()) return base;

    const tolerance = new Prisma.Decimal(10)
      .pow(-decimalPlaces)
      .times(0.5)
      .times(lines.length);
    if (diff.abs().greaterThan(tolerance)) return base;

    // Debits too high -> trim the largest debit; credits too high -> trim the largest credit.
    const side = diff.greaterThan(0) ? 'debit' : 'credit';
    let largest = -1;
    for (const [index, line] of base.entries()) {
      if (largest === -1 || line[side].greaterThan(base[largest][side])) {
        largest = index;
      }
    }
    if (largest === -1 || base[largest][side].lessThanOrEqualTo(diff.abs())) {
      return base;
    }
    base[largest][side] = base[largest][side].minus(diff.abs());
    return base;
  }

  validateCurrencyPrecision(
    lines: JournalAmountLine[],
    currency: string,
    decimalPlaces: number,
  ): void {
    for (const [index, line] of lines.entries()) {
      for (const amount of [line.debit ?? 0, line.credit ?? 0]) {
        if (new Prisma.Decimal(amount).decimalPlaces() > decimalPlaces) {
          throw new BadRequestException(
            `Journal line ${index + 1} exceeds ${currency} precision of ${decimalPlaces} decimal places`,
          );
        }
      }
    }
  }
}
