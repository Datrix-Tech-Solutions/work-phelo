/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any */
import { BadRequestException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  AccountingSettlementMethod,
  CashbookDirection,
  CashbookLineKind,
  CashbookTransactionStatus,
  CashbookTransactionType,
  JournalStatus,
} from '../../prisma/generated/client';
import { CashbookService } from './cashbook.service';
import { normalizeEntryLines } from './cashbook-lines.util';

const actor = {
  id: 'user-1',
  tenantId: 'tenant-1',
  role: 'EMPLOYEE',
  permissions: [],
} as unknown as RequestUser;

const decimal = (value: string) => ({
  toString: () => value,
});

function setup() {
  const prisma: Record<string, any> = {
    accountingCurrency: {
      findUnique: jest.fn().mockResolvedValue({ code: 'GHS', isActive: true }),
    },
    gLAccount: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'any', allowPosting: true, status: 'ACTIVE' }),
    },
    accountingCashAccount: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'cash-1',
        currency: 'GHS',
        isActive: true,
        glAccountId: 'cash-gl',
        glAccount: { id: 'cash-gl' },
      }),
    },
    cashbookTransaction: {
      create: jest.fn().mockResolvedValue({
        id: 'cb-1',
        transactionType: CashbookTransactionType.PAYMENT,
        transactionNumber: null,
      }),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    fiscalPeriod: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'period-1', status: 'OPEN' }),
    },
    accountingAuditLog: { create: jest.fn() },
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) =>
    Promise.resolve(fn(prisma)),
  );
  const journals = {
    createPostedInTransaction: jest.fn().mockResolvedValue({
      id: 'journal-1',
      journalNumber: 'AUTO-001',
      status: JournalStatus.POSTED,
    }),
  };
  const service = new CashbookService(prisma as never, journals as never);
  return { prisma, journals, service };
}

const entry = {
  cashAccountId: 'cash-1',
  currency: 'GHS',
  transactionDate: '2026-10-07',
  settlementMethod: AccountingSettlementMethod.CASH,
  description: 'Office expenses',
};

describe('CashbookService multi-line entries', () => {
  it('creates one entry whose amount is the sum of its lines', async () => {
    const { prisma, service } = setup();
    await service.createPayment(actor, {
      ...entry,
      lines: [
        { glAccountId: 'rent', amount: 2000 },
        { glAccountId: 'insurance', amount: 70000, description: 'Policy' },
        { glAccountId: 'stationery', amount: 4000 },
      ],
    });

    const data = prisma.cashbookTransaction.create.mock.calls[0][0].data;
    expect(Number(data.amount.toString())).toBe(76000);
    expect(data.offsetGlAccountId).toBe('rent');
    expect(data.quantity).toBeUndefined();
    expect(data.lines.create).toHaveLength(3);
    expect(data.lines.create[1]).toMatchObject({
      sequence: 2,
      glAccountId: 'insurance',
      description: 'Policy',
    });
  });

  it('still accepts the single offset account and amount, as one line', async () => {
    const { prisma, service } = setup();
    await service.createPayment(actor, {
      ...entry,
      offsetGlAccountId: 'rent',
      amount: 2000,
      quantity: 2,
      unitPrice: 1000,
    });

    const data = prisma.cashbookTransaction.create.mock.calls[0][0].data;
    expect(data.lines.create).toEqual([
      expect.objectContaining({ sequence: 1, glAccountId: 'rent' }),
    ]);
    expect(data.quantity).toBe(2);
    expect(data.unitPrice).toBe(1000);
  });

  it("rejects a line on the entry's own cash account", async () => {
    const { prisma, service } = setup();
    await expect(
      service.createPayment(actor, {
        ...entry,
        lines: [{ glAccountId: 'cash-gl', amount: 10 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.cashbookTransaction.create).not.toHaveBeenCalled();
  });

  const posted = (direction: CashbookDirection) => ({
    id: 'cb-1',
    tenantId: 'tenant-1',
    status: CashbookTransactionStatus.DRAFT,
    transactionType:
      direction === CashbookDirection.OUTFLOW
        ? CashbookTransactionType.PAYMENT
        : CashbookTransactionType.RECEIPT,
    direction,
    amount: decimal('76000'),
    currency: 'GHS',
    transactionDate: new Date('2026-10-07T00:00:00Z'),
    reference: 'CHQ-1',
    description: 'Office expenses',
    exchangeRate: null,
    offsetGlAccountId: 'rent',
    offsetSubledgerAccountId: null,
    sourceModule: null,
    sourceRecordId: null,
    cashAccount: { glAccountId: 'cash-gl' },
    lines: [
      { glAccountId: 'rent', amount: decimal('2000'), description: null },
      {
        glAccountId: 'insurance',
        amount: decimal('70000'),
        description: 'Policy',
      },
      { glAccountId: 'stationery', amount: decimal('4000'), description: null },
    ],
  });

  it('posts a payment as one debit per line and a single credit to cash', async () => {
    const { prisma, journals, service } = setup();
    prisma.cashbookTransaction.findFirst.mockResolvedValue(
      posted(CashbookDirection.OUTFLOW),
    );
    await service.postTransaction(actor, 'cb-1');

    const dto = journals.createPostedInTransaction.mock.calls[0][2];
    expect(dto.lines).toEqual([
      expect.objectContaining({ glAccountId: 'rent', debit: 2000, credit: 0 }),
      expect.objectContaining({
        glAccountId: 'insurance',
        debit: 70000,
        credit: 0,
        description: 'Policy',
      }),
      expect.objectContaining({ glAccountId: 'stationery', debit: 4000 }),
      expect.objectContaining({
        glAccountId: 'cash-gl',
        debit: 0,
        credit: 76000,
      }),
    ]);
  });

  it('posts a receipt as a single debit to cash and one credit per line', async () => {
    const { prisma, journals, service } = setup();
    prisma.cashbookTransaction.findFirst.mockResolvedValue(
      posted(CashbookDirection.INFLOW),
    );
    await service.postTransaction(actor, 'cb-1');

    const dto = journals.createPostedInTransaction.mock.calls[0][2];
    expect(dto.lines[0]).toMatchObject({
      glAccountId: 'cash-gl',
      debit: 76000,
    });
    expect(
      dto.lines.slice(1).map((l: any) => [l.glAccountId, l.credit]),
    ).toEqual([
      ['rent', 2000],
      ['insurance', 70000],
      ['stationery', 4000],
    ]);
  });

  it('refuses to post lines that do not add up to the entry amount', async () => {
    const { prisma, service } = setup();
    prisma.cashbookTransaction.findFirst.mockResolvedValue({
      ...posted(CashbookDirection.OUTFLOW),
      amount: decimal('1'),
    });
    await expect(service.postTransaction(actor, 'cb-1')).rejects.toThrow(
      'do not add up',
    );
  });
});

describe('normalizeEntryLines', () => {
  it('rejects lines together with a single offset account', () => {
    expect(() =>
      normalizeEntryLines({
        offsetGlAccountId: 'a',
        lines: [{ glAccountId: 'b', amount: 1 }],
      }),
    ).toThrow('not both');
  });

  it('rejects an amount that is not the sum of the lines', () => {
    expect(() =>
      normalizeEntryLines({
        amount: 5,
        lines: [
          { glAccountId: 'a', amount: 1 },
          { glAccountId: 'b', amount: 2 },
        ],
      }),
    ).toThrow('net of the lines');
  });

  it('checks quantity × unit price on each line', () => {
    expect(() =>
      normalizeEntryLines({
        lines: [{ glAccountId: 'a', amount: 10, quantity: 2, unitPrice: 3 }],
      }),
    ).toThrow('quantity × unitPrice');
  });

  it('needs lines, or an offset account and an amount', () => {
    expect(() => normalizeEntryLines({ amount: 5 })).toThrow('Send lines');
    expect(() => normalizeEntryLines({ offsetGlAccountId: 'a' })).toThrow(
      'Send lines',
    );
  });

  it('puts the subledger account on the first line, which must be an item', () => {
    expect(() =>
      normalizeEntryLines({
        offsetSubledgerAccountId: 's',
        lines: [
          { glAccountId: 'a', amount: 10 },
          { kind: CashbookLineKind.DEDUCTION, glAccountId: 'b', amount: 2 },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      normalizeEntryLines({
        offsetSubledgerAccountId: 's',
        lines: [
          { kind: CashbookLineKind.DEDUCTION, glAccountId: 'b', amount: 2 },
          { glAccountId: 'a', amount: 10 },
        ],
      }),
    ).toThrow('first line');
  });
});

describe('deductions and charges', () => {
  const lines = [
    { kind: CashbookLineKind.ITEM, glAccountId: 'inventory', amount: 10000 },
    {
      kind: CashbookLineKind.DEDUCTION,
      glAccountId: 'discount',
      amount: 500,
    },
    { kind: CashbookLineKind.DEDUCTION, glAccountId: 'wht', amount: 300 },
    { kind: CashbookLineKind.CHARGE, glAccountId: 'bank-charge', amount: 20 },
  ];

  it('moves the net: items + charges − deductions', () => {
    expect(Number(normalizeEntryLines({ lines }).total.toString())).toBe(9220);
  });

  it('defaults a line with no kind to an item', () => {
    const result = normalizeEntryLines({
      lines: [{ glAccountId: 'a', amount: 5 }],
    });
    expect(result.lines[0].kind).toBe(CashbookLineKind.ITEM);
  });

  it('needs at least one item', () => {
    expect(() =>
      normalizeEntryLines({
        lines: [{ kind: CashbookLineKind.CHARGE, glAccountId: 'a', amount: 5 }],
      }),
    ).toThrow('at least one line must be an item'.replace('at', 'At'));
  });

  it('refuses deductions that leave nothing to move', () => {
    expect(() =>
      normalizeEntryLines({
        lines: [
          { glAccountId: 'a', amount: 100 },
          { kind: CashbookLineKind.DEDUCTION, glAccountId: 'b', amount: 100 },
        ],
      }),
    ).toThrow('above zero');
  });

  it('gives deductions and charges an amount only', () => {
    expect(() =>
      normalizeEntryLines({
        lines: [
          { glAccountId: 'a', amount: 100 },
          {
            kind: CashbookLineKind.DEDUCTION,
            glAccountId: 'b',
            amount: 10,
            quantity: 1,
            unitPrice: 10,
          },
        ],
      }),
    ).toThrow('amount only');
  });

  it('checks a sent amount against the net', () => {
    expect(() => normalizeEntryLines({ amount: 10000, lines })).toThrow(
      'net of the lines',
    );
  });

  it('stores the net as the entry amount, keeping each line kind', async () => {
    const { prisma, service } = setup();
    await service.createPayment(actor, {
      cashAccountId: 'cash-1',
      currency: 'GHS',
      transactionDate: '2026-10-07',
      settlementMethod: AccountingSettlementMethod.CASH,
      description: 'Goods',
      lines,
    });
    const data = prisma.cashbookTransaction.create.mock.calls[0][0].data;
    expect(Number(data.amount.toString())).toBe(9220);
    expect(data.offsetGlAccountId).toBe('inventory');
    expect(data.lines.create.map((l: any) => l.kind)).toEqual([
      'ITEM',
      'DEDUCTION',
      'DEDUCTION',
      'CHARGE',
    ]);
  });

  const entry = (direction: CashbookDirection) => ({
    id: 'cb-1',
    tenantId: 'tenant-1',
    status: CashbookTransactionStatus.DRAFT,
    transactionType:
      direction === CashbookDirection.OUTFLOW
        ? CashbookTransactionType.PAYMENT
        : CashbookTransactionType.RECEIPT,
    direction,
    amount: decimal('9220'),
    currency: 'GHS',
    transactionDate: new Date('2026-10-07T00:00:00Z'),
    reference: 'X',
    description: 'Goods',
    exchangeRate: null,
    offsetGlAccountId: 'inventory',
    offsetSubledgerAccountId: null,
    sourceModule: null,
    sourceRecordId: null,
    cashAccount: { glAccountId: 'cash-gl' },
    lines: lines.map((l) => ({
      kind: l.kind,
      glAccountId: l.glAccountId,
      amount: decimal(String(l.amount)),
      description: null,
    })),
  });

  const sides = (dto: any) =>
    dto.lines.map((l: any) => [
      l.glAccountId,
      l.debit > 0 ? `DR ${l.debit}` : `CR ${l.credit}`,
    ]);

  it('posts a payment: items and charges debit, deductions credit, cash credits the net', async () => {
    const { prisma, journals, service } = setup();
    prisma.cashbookTransaction.findFirst.mockResolvedValue(
      entry(CashbookDirection.OUTFLOW),
    );
    await service.postTransaction(actor, 'cb-1');
    const dto = journals.createPostedInTransaction.mock.calls[0][2];
    expect(sides(dto)).toEqual([
      ['inventory', 'DR 10000'],
      ['discount', 'CR 500'],
      ['wht', 'CR 300'],
      ['bank-charge', 'DR 20'],
      ['cash-gl', 'CR 9220'],
    ]);
  });

  it('posts a receipt the other way round', async () => {
    const { prisma, journals, service } = setup();
    prisma.cashbookTransaction.findFirst.mockResolvedValue(
      entry(CashbookDirection.INFLOW),
    );
    await service.postTransaction(actor, 'cb-1');
    const dto = journals.createPostedInTransaction.mock.calls[0][2];
    expect(sides(dto)).toEqual([
      ['cash-gl', 'DR 9220'],
      ['inventory', 'CR 10000'],
      ['discount', 'DR 500'],
      ['wht', 'DR 300'],
      ['bank-charge', 'CR 20'],
    ]);
  });
});
