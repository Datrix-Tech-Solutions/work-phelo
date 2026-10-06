import { BadRequestException } from '@nestjs/common';
import { GLAccountCategory } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveMainLineAccount, RuleLineScope } from './rule-account-scope';

const fixed: RuleLineScope = {
  accountId: 'acc-furniture',
  scopeCategory: null,
  scopeClassificationId: null,
};
const byCategory: RuleLineScope = {
  accountId: null,
  scopeCategory: GLAccountCategory.ASSET,
  scopeClassificationId: null,
};
const byClassification: RuleLineScope = {
  accountId: null,
  scopeCategory: null,
  scopeClassificationId: 'cls-fixed-assets',
};

type FindFirstArgs = [{ where: Record<string, unknown> }];

function prismaReturning(account: { id: string } | null) {
  const findFirst = jest
    .fn<Promise<{ id: string } | null>, FindFirstArgs>()
    .mockResolvedValue(account);
  return {
    prisma: { gLAccount: { findFirst } } as unknown as PrismaService,
    findFirst,
  };
}

describe('resolveMainLineAccount', () => {
  it('uses a fixed rule account without a lookup', async () => {
    const { prisma, findFirst } = prismaReturning(null);
    await expect(
      resolveMainLineAccount(prisma, 't1', fixed, undefined, []),
    ).resolves.toBe('acc-furniture');
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('rejects a different account when the rule fixes one', async () => {
    const { prisma } = prismaReturning(null);
    await expect(
      resolveMainLineAccount(prisma, 't1', fixed, 'acc-other', []),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a pick when the main line is scoped', async () => {
    const { prisma } = prismaReturning(null);
    await expect(
      resolveMainLineAccount(prisma, 't1', byCategory, undefined, []),
    ).rejects.toThrow('Select the account');
  });

  it('accepts a posting account inside a category scope', async () => {
    const { prisma, findFirst } = prismaReturning({ id: 'acc-inventory' });
    await expect(
      resolveMainLineAccount(prisma, 't1', byCategory, 'acc-inventory', []),
    ).resolves.toBe('acc-inventory');
    expect(findFirst.mock.calls[0][0].where).toMatchObject({
      tenantId: 't1',
      category: GLAccountCategory.ASSET,
      allowPosting: true,
      childAccounts: { none: {} },
      cashAccounts: { none: {} },
    });
  });

  it('filters a classification scope by classification, not category', async () => {
    const { prisma, findFirst } = prismaReturning({ id: 'acc-furniture' });
    await resolveMainLineAccount(
      prisma,
      't1',
      byClassification,
      'acc-furniture',
      [],
    );
    const where = findFirst.mock.calls[0][0].where;
    expect(where.classificationId).toBe('cls-fixed-assets');
    expect(where.category).toBeUndefined();
  });

  it('rejects an account outside the scope', async () => {
    const { prisma } = prismaReturning(null);
    await expect(
      resolveMainLineAccount(prisma, 't1', byClassification, 'acc-cash', []),
    ).rejects.toThrow('not allowed');
  });

  it("rejects the rule's own control account", async () => {
    const { prisma } = prismaReturning({ id: 'acc-payable' });
    await expect(
      resolveMainLineAccount(prisma, 't1', byCategory, 'acc-payable', [
        'acc-payable',
      ]),
    ).rejects.toThrow('not allowed');
  });
});
