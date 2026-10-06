import { BadRequestException } from '@nestjs/common';
import { GLAccountCategory, RecordStatus } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';

/** What a rule line posts to: one fixed account, or a scope the user picks an account from
 *  on the transaction form — a whole category, or one classification within it. */
export interface RuleLineScope {
  accountId: string | null;
  scopeCategory: GLAccountCategory | null;
  scopeClassificationId: string | null;
}

export const isScopedLine = (line: RuleLineScope) => line.accountId === null;

/** The account a rule-driven document's main line posts to. A fixed line always uses its own
 *  account; a scoped line needs the account the user picked, which must sit inside the scope.
 *  `excludeAccountIds` are the rule's own control and tax accounts — never valid as the
 *  main line. Re-checked here on every create, so a hand-built request can't post outside
 *  the scope the rule allows. */
export async function resolveMainLineAccount(
  prisma: PrismaService,
  tenantId: string,
  line: RuleLineScope,
  chosenAccountId: string | undefined,
  excludeAccountIds: string[],
): Promise<string> {
  if (line.accountId) {
    if (chosenAccountId && chosenAccountId !== line.accountId) {
      throw new BadRequestException(
        "This transaction type's account is fixed by its rule and cannot be changed",
      );
    }
    return line.accountId;
  }
  if (!chosenAccountId) {
    throw new BadRequestException(
      'Select the account for this transaction — its rule lets you choose',
    );
  }
  const account = await prisma.gLAccount.findFirst({
    where: {
      id: chosenAccountId,
      tenantId,
      status: RecordStatus.ACTIVE,
      allowPosting: true,
      childAccounts: { none: {} },
      // A cash/bank account is settled through the Cashbook, never a purchase or sale line.
      cashAccounts: { none: {} },
      ...(line.scopeClassificationId
        ? { classificationId: line.scopeClassificationId }
        : { category: line.scopeCategory ?? undefined }),
    },
    select: { id: true },
  });
  if (!account || excludeAccountIds.includes(account.id)) {
    throw new BadRequestException(
      "The selected account is not allowed by this transaction type's rule",
    );
  }
  return account.id;
}
