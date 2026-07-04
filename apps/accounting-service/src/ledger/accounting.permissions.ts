export const AccountingPermission = {
  SETTINGS_VIEW: 'accounting.settings:VIEW',
  SETTINGS_EDIT: 'accounting.settings:EDIT',
  ACCOUNTS_VIEW: 'accounting.accounts:VIEW',
  ACCOUNTS_CREATE: 'accounting.accounts:CREATE',
  ACCOUNTS_EDIT: 'accounting.accounts:EDIT',
  JOURNALS_VIEW: 'accounting.journals:VIEW',
  JOURNALS_CREATE: 'accounting.journals:CREATE',
  JOURNALS_EDIT: 'accounting.journals:EDIT',
  JOURNALS_POST: 'accounting.journals:APPROVE',
  LEDGER_VIEW: 'accounting.ledger:VIEW',
} as const;
