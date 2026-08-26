import { AccountScope, CATEGORIES } from '@/components/organisms/accounting/ChartOfAccountsTree';
import { AccountGroup, GLAccount } from '@/types/accounting';

/** Leaf accounts belonging to the current scope — everything, one type, one classification,
 *  or one group. An `account` scope has nothing left to list (the panel shows its detail
 *  view instead), so it resolves to an empty list here. */
export function getScopedAccounts(
  scope: AccountScope,
  glAccounts: GLAccount[],
  groups: AccountGroup[],
): GLAccount[] {
  switch (scope.kind) {
    case 'all':
      return glAccounts;
    case 'category':
      return glAccounts.filter((account) => account.category === scope.category);
    case 'classification': {
      const groupIds = new Set(
        groups
          .filter((group) => group.classificationId === scope.classification.id)
          .map((group) => group.id),
      );
      return glAccounts.filter(
        (account) => account.accountGroupId && groupIds.has(account.accountGroupId),
      );
    }
    case 'group':
      return glAccounts.filter((account) => account.accountGroupId === scope.group.id);
    case 'account':
      return [];
  }
}

/** Human-readable heading for the current scope, used by the list/detail panel header. */
export function getScopeTitle(scope: AccountScope): string {
  switch (scope.kind) {
    case 'all':
      return 'All Accounts';
    case 'category':
      return `${CATEGORIES.find((c) => c.value === scope.category)?.label ?? scope.category} Accounts`;
    case 'classification':
      return `${scope.classification.code} — ${scope.classification.name}`;
    case 'group':
      return `${scope.group.code} — ${scope.group.name}`;
    case 'account':
      return scope.account.name;
  }
}
