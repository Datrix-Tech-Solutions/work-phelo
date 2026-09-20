import { Prisma } from '../../prisma/generated/client';
import { BadRequestException } from '@nestjs/common';
import { JournalPolicy } from './journal.policy';

describe('JournalPolicy', () => {
  const policy = new JournalPolicy();

  it('accepts a balanced double-entry journal', () => {
    expect(() =>
      policy.validateBalanced([
        { debit: 100, credit: 0 },
        { debit: 0, credit: 100 },
      ]),
    ).not.toThrow();
  });

  it('rejects an unbalanced journal', () => {
    expect(() =>
      policy.validateBalanced([
        { debit: 100, credit: 0 },
        { debit: 0, credit: 90 },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects a line with both debit and credit', () => {
    expect(() =>
      policy.validateBalanced([
        { debit: 100, credit: 100 },
        { debit: 0, credit: 0 },
      ]),
    ).toThrow('must contain either a debit or a credit');
  });

  it('calculates rounded base-currency amounts deterministically', () => {
    expect(policy.baseAmount(100, 15.4567, 2).toFixed(2)).toBe('1545.67');
  });

  it('rejects amounts beyond the configured currency precision', () => {
    expect(() =>
      policy.validateCurrencyPrecision(
        [
          { debit: 100.001, credit: 0 },
          { debit: 0, credit: 100.001 },
        ],
        'GHS',
        2,
      ),
    ).toThrow('exceeds GHS precision of 2 decimal places');
  });

  describe('base amount allocation', () => {
    const total = (
      amounts: Array<{ debit: Prisma.Decimal; credit: Prisma.Decimal }>,
      side: 'debit' | 'credit',
    ) =>
      amounts
        .reduce((sum, line) => sum.plus(line[side]), new Prisma.Decimal(0))
        .toFixed(2);

    it('leaves amounts alone when rounding already balances', () => {
      const result = policy.allocateBaseAmounts(
        [
          { debit: 100, credit: 0 },
          { debit: 0, credit: 100 },
        ],
        1,
        2,
      );
      expect(total(result, 'debit')).toBe('100.00');
      expect(total(result, 'credit')).toBe('100.00');
    });

    it('trims the largest line on the heavier side to absorb a rounding cent', () => {
      // 0.04 -> 0.02 debit; 0.01 -> 0.01 and 0.03 -> 0.02 credit (half-up), 0.03 vs 0.02.
      const result = policy.allocateBaseAmounts(
        [
          { debit: 0.04, credit: 0 },
          { debit: 0, credit: 0.01 },
          { debit: 0, credit: 0.03 },
        ],
        0.5,
        2,
      );
      expect(total(result, 'debit')).toBe(total(result, 'credit'));
      expect(result[2].credit.toFixed(2)).toBe('0.01');
    });

    it('does not hide a real imbalance', () => {
      const result = policy.allocateBaseAmounts(
        [
          { debit: 100, credit: 0 },
          { debit: 0, credit: 99 },
        ],
        1,
        2,
      );
      expect(total(result, 'debit')).toBe('100.00');
      expect(total(result, 'credit')).toBe('99.00');
    });
  });
});
