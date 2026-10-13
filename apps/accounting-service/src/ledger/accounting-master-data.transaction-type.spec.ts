import { RequestUser } from '@work-phelo/types';
import { TransactionTypeCategory } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingMasterDataService } from './accounting-master-data.service';

const user = { id: 'u1', tenantId: 't1' } as RequestUser;

const stored = {
  id: 'tt1',
  name: 'Expense Payment',
  code: 'EXP-PAY',
  category: TransactionTypeCategory.PAYABLE,
  businessRoles: [],
  allowedDocument: null,
  source: null,
  sourceTypeId: null,
  description: null,
  postsToCashbook: true,
  isLinked: false,
  usesQuantityPrice: true,
  createdAt: new Date('2026-10-07T00:00:00Z'),
  rule: null,
};

function setup() {
  const create = jest
    .fn<Promise<typeof stored>, [{ data: Record<string, unknown> }]>()
    .mockImplementation(({ data }) =>
      Promise.resolve({ ...stored, ...data } as typeof stored),
    );
  const update = jest
    .fn<Promise<typeof stored>, [{ data: Record<string, unknown> }]>()
    .mockImplementation(({ data }) =>
      Promise.resolve({ ...stored, ...data } as typeof stored),
    );
  const prisma = {
    transactionType: {
      create,
      update,
      findFirst: jest.fn().mockResolvedValue(stored),
    },
    accountingAuditLog: { create: jest.fn() },
  } as unknown as PrismaService;
  return { service: new AccountingMasterDataService(prisma), create, update };
}

describe('transaction type usesQuantityPrice', () => {
  it('defaults to on when creating a type', async () => {
    const { service, create } = setup();
    const result = await service.createTransactionType(user, {
      name: 'Expense Payment',
      code: 'EXP-PAY',
      category: TransactionTypeCategory.PAYABLE,
      postsToCashbook: true,
    });
    expect(create.mock.calls[0][0].data.usesQuantityPrice).toBe(true);
    expect(result.usesQuantityPrice).toBe(true);
  });

  it('saves a straight-amount type when switched off', async () => {
    const { service, create } = setup();
    const result = await service.createTransactionType(user, {
      name: 'Expense Payment',
      code: 'EXP-PAY',
      category: TransactionTypeCategory.PAYABLE,
      postsToCashbook: true,
      usesQuantityPrice: false,
    });
    expect(create.mock.calls[0][0].data.usesQuantityPrice).toBe(false);
    expect(result.usesQuantityPrice).toBe(false);
  });

  it('only changes the setting on update when it is sent', async () => {
    const { service, update } = setup();
    await service.updateTransactionType(user, 'tt1', { name: 'Renamed' });
    expect(update.mock.calls[0][0].data).not.toHaveProperty(
      'usesQuantityPrice',
    );
    await service.updateTransactionType(user, 'tt1', {
      usesQuantityPrice: false,
    });
    expect(update.mock.calls[1][0].data.usesQuantityPrice).toBe(false);
  });
});
