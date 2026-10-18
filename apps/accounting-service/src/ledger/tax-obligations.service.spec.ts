import {
  GLAccountCategory,
  NormalBalance,
  Prisma,
  TaxPayFrequency,
} from '../../prisma/generated/client';
import { TaxObligationsService } from './tax-obligations.service';

const dec = (value: number) => new Prisma.Decimal(value);

function build(owed: number, paid: number, reminderEnabled = true) {
  const aggregate = jest
    .fn()
    // First call: the balance at the end of the period. Second: payments since.
    .mockResolvedValueOnce({
      _sum: { baseDebit: dec(0), baseCredit: dec(owed) },
    })
    .mockResolvedValueOnce({
      _sum: { baseDebit: dec(paid), baseCredit: dec(0) },
    });
  const prisma = {
    accountingTenantConfig: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ baseCurrency: 'GHS', fiscalYearStartMonth: 1 }),
    },
    taxType: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'tax-1',
          code: 'VAT',
          name: 'Value Added Tax',
          reminderEnabled,
          reminderFrequency: TaxPayFrequency.MONTHLY,
          reminderDueDay: 15,
          reminderDueOnLastDay: false,
          reminderDaysBefore: 3,
          payableAccount: {
            id: 'acc-1',
            category: GLAccountCategory.LIABILITY,
            normalBalance: NormalBalance.CREDIT,
          },
        },
      ]),
    },
    journalLine: { aggregate },
  };
  return new TaxObligationsService(prisma as never);
}

describe('TaxObligationsService.listObligations', () => {
  // September is the last finished month, due on 15 October; the reminder starts on the 12th.
  it('lists what is still owed once the reminder window opens', async () => {
    const service = build(4200, 1200);
    const result = await service.listObligations('t1', new Date(2026, 9, 12));
    expect(result).toEqual([
      expect.objectContaining({
        taxTypeId: 'tax-1',
        periodEnd: '2026-09-30',
        dueDate: '2026-10-15',
        daysUntil: 3,
        amountOutstanding: '3000.00',
        currency: 'GHS',
      }),
    ]);
  });

  it('says nothing before the window opens', async () => {
    const service = build(4200, 0);
    expect(await service.listObligations('t1', new Date(2026, 9, 11))).toEqual(
      [],
    );
  });

  it('clears once the tax has been paid in full', async () => {
    const service = build(4200, 4200);
    expect(await service.listObligations('t1', new Date(2026, 9, 14))).toEqual(
      [],
    );
  });

  it('keeps showing after the due date until it is paid', async () => {
    const service = build(4200, 0);
    const result = await service.listObligations('t1', new Date(2026, 9, 20));
    expect(result[0]).toEqual(expect.objectContaining({ daysUntil: -5 }));
  });
});

describe('TaxObligationsService.listOutstanding', () => {
  it('uses the last finished period for a tax with a reminder', async () => {
    const service = build(4200, 1200);
    const result = await service.listOutstanding('t1', new Date(2026, 9, 5));
    expect(result).toEqual([
      expect.objectContaining({
        taxTypeId: 'tax-1',
        payableAccountId: 'acc-1',
        dueDate: '2026-10-15',
        amountOutstanding: '3000.00',
      }),
    ]);
  });

  it('uses what the account holds now for a tax without one', async () => {
    const aggregate = jest.fn().mockResolvedValue({
      _sum: { baseDebit: dec(500), baseCredit: dec(2000) },
    });
    const service = build(0, 0, false);
    (
      service as unknown as { prisma: { journalLine: unknown } }
    ).prisma.journalLine = {
      aggregate,
    };
    const result = await service.listOutstanding('t1', new Date(2026, 9, 5));
    expect(result[0]).toEqual(
      expect.objectContaining({ dueDate: null, amountOutstanding: '1500.00' }),
    );
  });

  it('shows zero rather than a negative amount', async () => {
    const service = build(100, 400);
    const result = await service.listOutstanding('t1', new Date(2026, 9, 5));
    expect(result[0].amountOutstanding).toBe('0.00');
  });
});
