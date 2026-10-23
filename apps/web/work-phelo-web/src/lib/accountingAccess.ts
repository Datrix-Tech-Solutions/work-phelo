/**
 * Which permissions make each Accounting page (and each tab of a multi-tab page) reachable, mirroring
 * what the backend routes behind them demand. A page is keyed by its path segment under /accounting.
 */

/**
 * An accountant is a module user: someone holding at least one accounting permission (or an admin).
 * Anyone else sees none of the Accounting pages.
 */
export const ACCOUNTING_PERMISSION_PREFIX = 'accounting.';

/** Pages that take one of the listed permissions. A page not listed here is open to every accountant. */
export const ACCOUNTING_PAGE_PERMISSIONS: Record<string, string[]> = {
  transactions: ['accounting.transactions:VIEW'],
  journalentry: ['accounting.journals:VIEW'],
  chartsofaccounts: ['accounting.accounts:VIEW'],
  cashandbank: ['accounting.cash-accounts:VIEW'],
  archive: ['accounting.archive:VIEW'],
  entities: ['accounting.entities:VIEW'],
  'cost-centres': ['accounting.cost-centres:VIEW'],
  'financial-reports': ['accounting.ledger:VIEW'],
  'general-ledger': ['accounting.ledger:VIEW'],
  'budget-forecast': ['accounting.budgets:VIEW'],
  'fiscal-year': ['accounting.settings:VIEW'],
  'source-events': ['accounting.journals:APPROVE'],
  accountsreceivable: ['accounting.receivables:VIEW'],
  accountspayable: ['accounting.payables:VIEW'],
  expensesandpurchases: ['accounting.payables:VIEW'],
};

const TRANSACTION_SETTINGS_VIEW = ['accounting.transaction-settings:VIEW'];
const SETTINGS_VIEW = ['accounting.settings:VIEW'];
const ROLE_VIEW = ['permission-sets:VIEW'];

/** Pages made of tabs. A page shows when at least one of its tabs does. */
export const ACCOUNTING_PAGE_TABS: Record<string, Record<string, string[]>> = {
  settings: {
    'transaction-types': TRANSACTION_SETTINGS_VIEW,
    'source-types': TRANSACTION_SETTINGS_VIEW,
    rules: TRANSACTION_SETTINGS_VIEW,
    'tax-types': SETTINGS_VIEW,
    currency: SETTINGS_VIEW,
  },
  'user-management': {
    'roles-permissions': ROLE_VIEW,
    'module-users': ROLE_VIEW,
  },
};
