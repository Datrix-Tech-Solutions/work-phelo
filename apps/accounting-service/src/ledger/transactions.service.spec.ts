import { Prisma } from '../../prisma/generated/client';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  const rows = [
    { kind: 'CASHBOOK', id: 'c1' },
    { kind: 'RECEIVABLE', id: 'r1' },
    { kind: 'PAYABLE', id: 'p1' },
    { kind: 'RECEIVABLE', id: 'r2' },
  ];

  function build(pageRows: { kind: string; id: string }[] = rows) {
    const queries: Prisma.Sql[] = [];
    const prisma = {
      $queryRaw: jest.fn((sql: Prisma.Sql) => {
        queries.push(sql);
        return Promise.resolve(
          sql.sql.includes('COUNT(*)') ? [{ count: BigInt(23) }] : pageRows,
        );
      }),
      accountingReceivableAllocation: {
        findMany: jest.fn().mockResolvedValue([
          {
            receiptId: 'rc1',
            invoice: { id: 'inv1', documentNumber: 'INV-0001' },
          },
        ]),
      },
      accountingPayableAllocation: {
        findMany: jest.fn().mockResolvedValue([
          {
            paymentId: 'pay1',
            bill: { id: 'bill1', documentNumber: 'BILL-0001' },
          },
          {
            paymentId: 'pay1',
            bill: { id: 'bill1', documentNumber: 'BILL-0001' },
          },
          {
            paymentId: 'pay1',
            bill: { id: 'bill2', documentNumber: 'BILL-0002' },
          },
        ]),
      },
    };
    const receivables = {
      listDocumentsByIds: jest.fn((_t: string, ids: string[]) =>
        Promise.resolve(ids.map((id) => ({ id }))),
      ),
      listReceiptsByIds: jest.fn((_t: string, ids: string[]) =>
        Promise.resolve(ids.map((id) => ({ id }))),
      ),
    };
    const payables = {
      listDocumentsByIds: jest.fn((_t: string, ids: string[]) =>
        Promise.resolve(ids.map((id) => ({ id }))),
      ),
      listPaymentsByIds: jest.fn((_t: string, ids: string[]) =>
        Promise.resolve(ids.map((id) => ({ id }))),
      ),
    };
    const cashbook = {
      listTransactionsByIds: jest.fn((_t: string, ids: string[]) =>
        Promise.resolve(ids.map((id) => ({ id }))),
      ),
    };
    const service = new TransactionsService(
      prisma as never,
      receivables as never,
      payables as never,
      cashbook as never,
    );
    return { service, queries, receivables, payables, cashbook, prisma };
  }

  it('returns the rows in the order the database sorted them, with the total', async () => {
    const { service, receivables, payables, cashbook } = build();
    const result = await service.list('t1', { page: 2, limit: 4 });

    expect(result.items.map((item) => [item.kind, item.record])).toEqual([
      ['CASHBOOK', { id: 'c1' }],
      ['RECEIVABLE', { id: 'r1' }],
      ['PAYABLE', { id: 'p1' }],
      ['RECEIVABLE', { id: 'r2' }],
    ]);
    expect(result).toMatchObject({
      total: 23,
      page: 2,
      limit: 4,
      totalPages: 6,
    });
    expect(receivables.listDocumentsByIds).toHaveBeenCalledWith('t1', [
      'r1',
      'r2',
    ]);
    expect(payables.listDocumentsByIds).toHaveBeenCalledWith('t1', ['p1']);
    expect(cashbook.listTransactionsByIds).toHaveBeenCalledWith('t1', ['c1']);
  });

  it('leaves voided entries out unless asked, and pages in the database', async () => {
    const { service, queries } = build();
    await service.list('t1', { page: 3, limit: 10 });
    const page = queries[0];
    expect(page.sql).toContain(`<> 'VOIDED'`);
    expect(page.sql).toContain('LIMIT');
    expect(page.values).toEqual(expect.arrayContaining([10, 20]));
  });

  it('only queries the sources a type filter needs', async () => {
    const { service, queries } = build();
    await service.list('t1', { type: 'TRANSFER' });
    const sql = queries[0].sql;
    expect(sql).toContain('CashbookTransaction');
    expect(sql).not.toContain('AccountingReceivableDocument');
    expect(sql).not.toContain('AccountingPayableDocument');
    expect(sql).toContain(`'TRANSFER'`);
  });

  it('keeps transfers out of the cashbook filter', async () => {
    const { service, queries } = build();
    await service.list('t1', { type: 'CASHBOOK' });
    expect(queries[0].sql).toContain(`<> 'TRANSFER'`);
  });

  it('passes the search as a bound, escaped pattern', async () => {
    const { service, queries } = build();
    await service.list('t1', { search: '50%_off' });
    expect(queries[0].sql).not.toContain('50%');
    expect(queries[0].values).toContain('%50\\%\\_off%');
  });

  it('leaves out cashbook entries that belong to a receipt or payment document', async () => {
    const { service, queries } = build();
    await service.list('t1', {});
    expect(queries[0].sql).toContain(
      `"sourceModule" IS DISTINCT FROM 'ACCOUNTING'`,
    );
    // Payments made by another module carry that module as their source, so the entry is also
    // matched to its receipt or payment, which is listed in its place.
    expect(queries[0].sql).toContain('"AccountingReceivableReceipt"');
    expect(queries[0].sql).toContain('"AccountingPayablePayment"');
  });

  it('lists receipts and payments with the invoices and bills they are applied to', async () => {
    const { service, receivables, payables } = build([
      { kind: 'RECEIVABLE_RECEIPT', id: 'rc1' },
      { kind: 'PAYABLE_PAYMENT', id: 'pay1' },
      { kind: 'PAYABLE_PAYMENT', id: 'pay2' },
    ]);
    const result = await service.list('t1', {});

    expect(receivables.listReceiptsByIds).toHaveBeenCalledWith('t1', ['rc1']);
    expect(payables.listPaymentsByIds).toHaveBeenCalledWith('t1', [
      'pay1',
      'pay2',
    ]);
    expect(result.items).toEqual([
      {
        kind: 'RECEIVABLE_RECEIPT',
        record: {
          id: 'rc1',
          linkedDocuments: [{ id: 'inv1', documentNumber: 'INV-0001' }],
        },
      },
      {
        kind: 'PAYABLE_PAYMENT',
        record: {
          id: 'pay1',
          // A bill allocated twice is linked once.
          linkedDocuments: [
            { id: 'bill1', documentNumber: 'BILL-0001' },
            { id: 'bill2', documentNumber: 'BILL-0002' },
          ],
        },
      },
      {
        kind: 'PAYABLE_PAYMENT',
        record: { id: 'pay2', linkedDocuments: [] },
      },
    ]);
  });

  it('shows receipts under receivables and payments under payables', async () => {
    const { service, queries } = build();
    await service.list('t1', { type: 'PAYABLE' });
    const sql = queries[0].sql;
    expect(sql).toContain('AccountingPayablePayment');
    expect(sql).not.toContain('"AccountingReceivableReceipt" d');
  });
});
