import { Prisma } from '../../prisma/generated/client';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  const rows = [
    { kind: 'CASHBOOK', id: 'c1' },
    { kind: 'RECEIVABLE', id: 'r1' },
    { kind: 'PAYABLE', id: 'p1' },
    { kind: 'RECEIVABLE', id: 'r2' },
  ];

  function build() {
    const queries: Prisma.Sql[] = [];
    const prisma = {
      $queryRaw: jest.fn((sql: Prisma.Sql) => {
        queries.push(sql);
        return Promise.resolve(
          sql.sql.includes('COUNT(*)') ? [{ count: BigInt(23) }] : rows,
        );
      }),
    };
    const receivables = {
      listDocumentsByIds: jest.fn((_t: string, ids: string[]) =>
        Promise.resolve(ids.map((id) => ({ id }))),
      ),
    };
    const payables = {
      listDocumentsByIds: jest.fn((_t: string, ids: string[]) =>
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
    return { service, queries, receivables, payables, cashbook };
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
  });
});
