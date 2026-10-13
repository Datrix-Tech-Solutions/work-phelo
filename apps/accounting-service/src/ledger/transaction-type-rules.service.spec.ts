import { BadRequestException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  GLAccountCategory,
  PostingDirection,
  RuleLineSettlementKind,
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
  scopes: [
    {
      category: GLAccountCategory.ASSET,
      classificationId: 'cls-fixed-assets',
    },
  ],
};

function setup(
  type: Record<string, unknown> = payableType,
  accountCategory: GLAccountCategory = GLAccountCategory.LIABILITY,
) {
  const create = jest
    .fn<Promise<unknown>, [{ data: { lines: { create: unknown[] } } }]>()
    .mockResolvedValue({ id: 'r1', lines: [] });
  const prisma = {
    transactionType: { findFirst: jest.fn().mockResolvedValue(type) },
    accountClassification: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'cls-fixed-assets',
        category: GLAccountCategory.ASSET,
      }),
    },
    transactionTypeRule: { create },
    accountingAuditLog: { create: jest.fn() },
  } as unknown as PrismaService;
  const masterData = {
    findGLAccount: jest.fn().mockResolvedValue({
      id: 'acc-trade-payable',
      category: accountCategory,
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
      scopes: {
        create: [
          {
            category: GLAccountCategory.ASSET,
            classificationId: 'cls-fixed-assets',
          },
        ],
      },
    });
  });

  it('accepts several scopes on one main line', async () => {
    const { service, create } = setup();
    await service.createRule(user, {
      transactionTypeId: 'tt1',
      lines: [
        {
          direction: PostingDirection.DR,
          scopes: [
            { category: GLAccountCategory.EXPENSE },
            {
              category: GLAccountCategory.ASSET,
              classificationId: 'cls-fixed-assets',
            },
          ],
        },
        payableControl,
      ],
    });
    const lines = create.mock.calls[0][0].data.lines.create;
    expect(lines[0]).toMatchObject({
      accountId: null,
      scopes: { create: [{ category: 'EXPENSE' }, { category: 'ASSET' }] },
    });
  });

  it('accepts specific accounts as scopes', async () => {
    const { service, create } = setup();
    await service.createRule(user, {
      transactionTypeId: 'tt1',
      lines: [
        {
          direction: PostingDirection.DR,
          scopes: [
            {
              category: GLAccountCategory.LIABILITY,
              accountId: 'acc-trade-payable',
            },
          ],
        },
        payableControl,
      ],
    });
    const lines = create.mock.calls[0][0].data.lines.create;
    expect(lines[0]).toMatchObject({
      scopes: {
        create: [{ category: 'LIABILITY', accountId: 'acc-trade-payable' }],
      },
    });
  });

  it('rejects an account listed under the wrong category', async () => {
    const { service } = setup();
    await expect(
      service.createRule(user, {
        transactionTypeId: 'tt1',
        lines: [
          {
            direction: PostingDirection.DR,
            scopes: [
              {
                category: GLAccountCategory.EXPENSE,
                accountId: 'acc-trade-payable',
              },
            ],
          },
          payableControl,
        ],
      }),
    ).rejects.toThrow('must sit inside');
  });

  it('rejects the same scope listed twice', async () => {
    const { service } = setup();
    await expect(
      service.createRule(user, {
        transactionTypeId: 'tt1',
        lines: [
          {
            direction: PostingDirection.DR,
            scopes: [
              { category: GLAccountCategory.EXPENSE },
              { category: GLAccountCategory.EXPENSE },
            ],
          },
          payableControl,
        ],
      }),
    ).rejects.toThrow('more than once');
  });

  it('rejects a classification listed under the wrong category', async () => {
    const { service } = setup();
    await expect(
      service.createRule(user, {
        transactionTypeId: 'tt1',
        lines: [
          {
            direction: PostingDirection.DR,
            scopes: [
              {
                category: GLAccountCategory.EXPENSE,
                classificationId: 'cls-fixed-assets',
              },
            ],
          },
          payableControl,
        ],
      }),
    ).rejects.toThrow('must belong to the category');
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
            scopes: [{ category: GLAccountCategory.LIABILITY }],
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
            scopes: [{ category: GLAccountCategory.EXPENSE }],
          },
        ],
      }),
    ).rejects.toThrow('fixed account');
  });
});

describe('TransactionTypeRulesService settlement lines', () => {
  const settlementDeduction = {
    direction: PostingDirection.CR,
    accountId: 'acc-wht',
    settlementKind: RuleLineSettlementKind.DEDUCTION,
  };
  const docLines = [
    { direction: PostingDirection.DR, accountId: 'acc-expense' },
    payableControl,
  ];

  it('keeps settlement lines out of the document rule, even on the control side', async () => {
    const { service, create } = setup();
    await service.createRule(user, {
      transactionTypeId: 'tt1',
      lines: [...docLines, settlementDeduction],
    });
    const written = create.mock.calls[0][0].data.lines.create as {
      settlementKind: string | null;
    }[];
    expect(written.map((l) => l.settlementKind)).toEqual([
      null,
      null,
      'DEDUCTION',
    ]);
  });

  it('puts a bill payment charge on the debit side and a deduction on the credit side', async () => {
    const { service } = setup();
    await expect(
      service.createRule(user, {
        transactionTypeId: 'tt1',
        lines: [
          ...docLines,
          {
            direction: PostingDirection.DR,
            accountId: 'acc-bank-charge',
            settlementKind: RuleLineSettlementKind.CHARGE,
          },
        ],
      }),
    ).resolves.toBeDefined();
    await expect(
      service.createRule(user, {
        transactionTypeId: 'tt1',
        lines: [
          ...docLines,
          { ...settlementDeduction, direction: PostingDirection.DR },
        ],
      }),
    ).rejects.toThrow('must be a credit line');
  });

  it('flips the sides for a receivable type', async () => {
    const { service } = setup(
      { ...payableType, category: TransactionTypeCategory.RECEIVABLE },
      GLAccountCategory.ASSET,
    );
    await expect(
      service.createRule(user, {
        transactionTypeId: 'tt1',
        lines: [
          { direction: PostingDirection.CR, accountId: 'acc-sales' },
          { direction: PostingDirection.DR, accountId: 'acc-ar' },
          {
            direction: PostingDirection.DR,
            accountId: 'acc-wht',
            settlementKind: RuleLineSettlementKind.DEDUCTION,
          },
        ],
      }),
    ).resolves.toBeDefined();
  });

  it('refuses settlement lines on a linked type', async () => {
    const { service } = setup({ ...payableType, isLinked: true });
    await expect(
      service.createRule(user, {
        transactionTypeId: 'tt1',
        lines: [
          { direction: PostingDirection.CR, accountId: 'acc-expense' },
          { direction: PostingDirection.DR, accountId: 'acc-trade-payable' },
          { ...settlementDeduction },
        ],
      }),
    ).rejects.toThrow('plain Receivable or Payable');
  });

  it('needs a fixed account, and only a deduction can carry a tax', async () => {
    const { service } = setup();
    await expect(
      service.createRule(user, {
        transactionTypeId: 'tt1',
        lines: [
          ...docLines,
          {
            direction: PostingDirection.CR,
            scopes: [{ category: GLAccountCategory.LIABILITY }],
            settlementKind: RuleLineSettlementKind.DEDUCTION,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createRule(user, {
        transactionTypeId: 'tt1',
        lines: [
          ...docLines,
          {
            direction: PostingDirection.DR,
            accountId: 'acc-bank-charge',
            taxTypeId: 'tax-1',
            settlementKind: RuleLineSettlementKind.CHARGE,
          },
        ],
      }),
    ).rejects.toThrow('Only a settlement deduction');
  });
});
