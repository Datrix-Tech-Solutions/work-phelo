import { BadRequestException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  GLAccountCategory,
  PostingDirection,
  TransactionTypeCategory,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingMasterDataService } from './accounting-master-data.service';
import { TransactionTypeRulesService } from './transaction-type-rules.service';

const user = { id: 'u1', tenantId: 't1' } as RequestUser;

const payableType = {
  id: 'tt1',
  category: TransactionTypeCategory.PAYABLE,
  postsToCashbook: false,
  isLinked: false,
  sourceTypeId: null,
  businessRoles: ['VENDOR'],
};

const payableControl = {
  direction: PostingDirection.CR,
  accountId: 'acc-trade-payable',
};
const scopedMain = {
  direction: PostingDirection.DR,
  scopeClassificationId: 'cls-fixed-assets',
};

function setup(type = payableType) {
  const create = jest
    .fn<Promise<unknown>, [{ data: { lines: { create: unknown[] } } }]>()
    .mockResolvedValue({ id: 'r1', lines: [] });
  const prisma = {
    transactionType: { findFirst: jest.fn().mockResolvedValue(type) },
    accountClassification: {
      findFirst: jest.fn().mockResolvedValue({ id: 'cls-fixed-assets' }),
    },
    transactionTypeRule: { create },
    accountingAuditLog: { create: jest.fn() },
  } as unknown as PrismaService;
  const masterData = {
    findGLAccount: jest.fn().mockResolvedValue({
      id: 'acc-trade-payable',
      category: GLAccountCategory.LIABILITY,
    }),
  } as unknown as AccountingMasterDataService;
  return {
    service: new TransactionTypeRulesService(prisma, masterData),
    create,
  };
}

describe('TransactionTypeRulesService scoped lines', () => {
  it('accepts a classification-scoped main line beside a fixed control line', async () => {
    const { service, create } = setup();
    await service.createRule(user, {
      transactionTypeId: 'tt1',
      lines: [scopedMain, payableControl],
    });
    const lines = create.mock.calls[0][0].data.lines.create;
    expect(lines[0]).toMatchObject({
      accountId: null,
      scopeClassificationId: 'cls-fixed-assets',
    });
  });

  it('rejects a scoped control line', async () => {
    const { service } = setup();
    await expect(
      service.createRule(user, {
        transactionTypeId: 'tt1',
        lines: [
          { direction: PostingDirection.DR, accountId: 'acc-x' },
          {
            direction: PostingDirection.CR,
            scopeCategory: GLAccountCategory.LIABILITY,
          },
        ],
      }),
    ).rejects.toThrow('Only the main');
  });

  it('rejects a line with both a fixed account and a scope', async () => {
    const { service } = setup();
    await expect(
      service.createRule(user, {
        transactionTypeId: 'tt1',
        lines: [{ ...scopedMain, accountId: 'acc-x' }, payableControl],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a scoped line on a source-linked type', async () => {
    const { service } = setup({
      ...payableType,
      sourceTypeId: 'src1',
    } as never);
    await expect(
      service.createRule(user, {
        transactionTypeId: 'tt1',
        lines: [scopedMain, payableControl],
      }),
    ).rejects.toThrow('Only the main');
  });

  it('needs a fixed account on a cashbook offset line', async () => {
    const { service } = setup({
      ...payableType,
      postsToCashbook: true,
    } as never);
    await expect(
      service.createRule(user, {
        transactionTypeId: 'tt1',
        lines: [
          {
            direction: PostingDirection.DR,
            scopeCategory: GLAccountCategory.EXPENSE,
          },
        ],
      }),
    ).rejects.toThrow('fixed account');
  });
});
