import { Prisma } from '../../prisma/generated/client';
import { runFiscalPeriodCloseChecks } from './fiscal-period-close-check';

const tenantId = 'tenant-1';
const period = {
  id: 'period-3',
  startDate: new Date('2026-03-01T00:00:00.000Z'),
  endDate: new Date('2026-03-31T00:00:00.000Z'),
};

const setup = () => {
  const client = {
    fiscalPeriod: { findMany: jest.fn().mockResolvedValue([]) },
    journalEntry: { count: jest.fn().mockResolvedValue(0) },
    accountingPayableDocument: { count: jest.fn().mockResolvedValue(0) },
    accountingReceivableDocument: { count: jest.fn().mockResolvedValue(0) },
    cashbookTransaction: { count: jest.fn().mockResolvedValue(0) },
    sourceEventInbox: { count: jest.fn().mockResolvedValue(0) },
    accountingCashAccount: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const run = () =>
    runFiscalPeriodCloseChecks(
      client as unknown as Prisma.TransactionClient,
      tenantId,
      period,
    );
  return { client, run };
};

describe('runFiscalPeriodCloseChecks', () => {
  it('passes a clean period', async () => {
    const { run } = setup();

    await expect(run()).resolves.toEqual({
      periodId: period.id,
      blockers: [],
      warnings: [],
      canClose: true,
    });
  });

  it('blocks on an earlier period that is still open, naming it', async () => {
    const { client, run } = setup();
    client.fiscalPeriod.findMany.mockResolvedValue([
      { name: '2026-01' },
      { name: '2026-02' },
    ]);

    const result = await run();

    expect(result.canClose).toBe(false);
    expect(result.blockers).toEqual([
      {
        code: 'PRIOR_PERIOD_OPEN',
        message: 'Earlier periods are still open: 2026-01, 2026-02',
        count: 2,
      },
    ]);
    expect(client.fiscalPeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId,
          status: 'OPEN',
          endDate: { lt: period.startDate },
        },
      }),
    );
  });

  it('blocks on every kind of draft, scoped to the period and tenant', async () => {
    const { client, run } = setup();
    client.journalEntry.count.mockResolvedValue(1);
    client.accountingPayableDocument.count.mockResolvedValue(2);
    client.accountingReceivableDocument.count.mockResolvedValue(3);
    client.cashbookTransaction.count.mockResolvedValue(4);

    const result = await run();

    expect(result.canClose).toBe(false);
    expect(result.blockers.map((b) => [b.code, b.count])).toEqual([
      ['DRAFT_JOURNALS', 1],
      ['DRAFT_PAYABLE_DOCUMENTS', 2],
      ['DRAFT_RECEIVABLE_DOCUMENTS', 3],
      ['DRAFT_CASHBOOK_TRANSACTIONS', 4],
    ]);
    expect(result.blockers[0].message).toBe('1 draft journal in this period');

    const inPeriod = { gte: period.startDate, lte: period.endDate };
    expect(client.journalEntry.count).toHaveBeenCalledWith({
      where: { tenantId, fiscalPeriodId: period.id, status: 'DRAFT' },
    });
    expect(client.accountingPayableDocument.count).toHaveBeenCalledWith({
      where: { tenantId, status: 'DRAFT', documentDate: inPeriod },
    });
    expect(client.accountingReceivableDocument.count).toHaveBeenCalledWith({
      where: { tenantId, status: 'DRAFT', documentDate: inPeriod },
    });
    expect(client.cashbookTransaction.count).toHaveBeenCalledWith({
      where: { tenantId, status: 'DRAFT', transactionDate: inPeriod },
    });
  });

  it('only warns about pending source events and unreconciled bank accounts', async () => {
    const { client, run } = setup();
    client.sourceEventInbox.count.mockResolvedValue(3);
    client.accountingCashAccount.findMany.mockResolvedValue([
      { name: 'GCB Current' },
      { name: 'Petty Cash' },
    ]);

    const result = await run();

    expect(result.canClose).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.warnings.map((w) => [w.code, w.count])).toEqual([
      ['SOURCE_EVENTS_PENDING', 3],
      ['BANK_RECONCILIATION_PENDING', 2],
    ]);
    expect(result.warnings[1].message).toContain('GCB Current, Petty Cash');
    expect(client.sourceEventInbox.count).toHaveBeenCalledWith({
      where: {
        tenantId,
        status: { in: ['RECEIVED', 'PROCESSING', 'FAILED'] },
      },
    });
  });

  it('asks for accounts with posted activity but no completed reconciliation to period end', async () => {
    const { client, run } = setup();

    await run();

    expect(client.accountingCashAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId,
          isActive: true,
          transactions: {
            some: {
              status: 'POSTED',
              transactionDate: { gte: period.startDate, lte: period.endDate },
            },
          },
          reconciliations: {
            none: {
              status: 'COMPLETED',
              statementEndDate: { gte: period.endDate },
            },
          },
        },
      }),
    );
  });
});
