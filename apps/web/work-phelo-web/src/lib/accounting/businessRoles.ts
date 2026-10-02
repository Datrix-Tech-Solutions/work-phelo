export interface BusinessRoleOption {
  value: string;
  label: string;
}

export interface BusinessRoleGroup {
  key: string;
  label: string;
  roles: BusinessRoleOption[];
}

export const BUSINESS_ROLE_GROUPS: BusinessRoleGroup[] = [
  {
    key: 'RECEIVABLES',
    label: 'Receivables & Prepayments',
    roles: [
      { value: 'ACCOUNTS_RECEIVABLE', label: 'Accounts Receivable' },
      { value: 'PREPAID_EXPENSES', label: 'Prepaid Expenses' },
      { value: 'INPUT_VAT', label: 'Purchase Tax' },
      { value: 'WITHHOLDING_TAX_RECEIVABLE', label: 'Withholding Tax Receivable' },
    ],
  },
  {
    key: 'PAYABLES',
    label: 'Payables & Accruals',
    roles: [
      { value: 'ACCOUNTS_PAYABLE', label: 'Accounts Payable' },
      { value: 'ACCRUED_LIABILITIES', label: 'Accrued Liabilities' },
      { value: 'OUTPUT_VAT', label: 'Sales Tax' },
      { value: 'WITHHOLDING_TAX_PAYABLE', label: 'Withholding Tax Payable' },
      { value: 'UNEARNED_REVENUE', label: 'Unearned Revenue' },
      { value: 'LOANS_PAYABLE', label: 'Loans Payable' },
    ],
  },
  {
    key: 'REVENUE_EXPENSE',
    label: 'Revenue & Expense',
    roles: [
      { value: 'SALES_REVENUE', label: 'Sales Revenue' },
      { value: 'EXPENSE', label: 'Expense' },
      { value: 'FX_GAIN_LOSS', label: 'Foreign Exchange Gain/Loss' },
    ],
  },
  {
    key: 'BANK_CASH',
    label: 'Bank & Cash',
    roles: [
      { value: 'BANK_CASH', label: 'Bank/Cash' },
      { value: 'UNDEPOSITED_FUNDS', label: 'Undeposited Funds' },
    ],
  },
  {
    key: 'FIXED_ASSETS',
    label: 'Fixed Assets',
    roles: [
      { value: 'FIXED_ASSETS', label: 'Fixed Assets' },
      { value: 'ACCUMULATED_DEPRECIATION', label: 'Accumulated Depreciation' },
    ],
  },
  {
    key: 'EQUITY',
    label: 'Equity',
    roles: [
      { value: 'RETAINED_EARNINGS', label: 'Retained Earnings' },
      { value: 'CURRENT_YEAR_EARNINGS', label: 'Current Year Earnings' },
      { value: 'SHARE_CAPITAL', label: 'Share Capital' },
    ],
  },
  {
    key: 'HOUSEKEEPING',
    label: 'Housekeeping',
    roles: [{ value: 'SUSPENSE_CLEARING', label: 'Suspense/Clearing' }],
  },
];

export const BUSINESS_ROLE_GROUP_OPTIONS: BusinessRoleOption[] = BUSINESS_ROLE_GROUPS.map((g) => ({
  value: g.key,
  label: g.label,
}));

export const ALL_BUSINESS_ROLE_OPTIONS: BusinessRoleOption[] = BUSINESS_ROLE_GROUPS.flatMap(
  (g) => g.roles,
);
