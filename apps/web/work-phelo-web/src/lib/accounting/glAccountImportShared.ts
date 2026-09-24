import {
  CASH_FLOW_CATEGORY_OPTIONS,
  type CashFlowCategory,
  type GLAccountCategory,
} from '@/types/accounting';

export const CLASSIFICATION_IMPORT_HEADERS = [
  'Classification Code',
  'Classification Name',
  'Account Type',
  'Cash Flow Category',
] as const;

export const GROUP_IMPORT_HEADERS = [
  'Parent Account Code',
  'Parent Account Name',
  'Classification Code',
  'Cash Flow Category',
] as const;

export const ACCOUNT_IMPORT_HEADERS = [
  'Account Code',
  'Account Name',
  'Account Type',
  'Classification Code',
  'Parent Account Code',
  'Cash Flow Category',
  'Description',
] as const;

export const CATEGORY_LABEL_BY_VALUE: Record<GLAccountCategory, string> = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expense',
};

export const CATEGORY_VALUE_BY_LABEL: Record<string, GLAccountCategory> = {
  asset: 'ASSET',
  liability: 'LIABILITY',
  equity: 'EQUITY',
  revenue: 'REVENUE',
  expense: 'EXPENSE',
};

export const CASH_FLOW_LABEL_BY_VALUE: Record<CashFlowCategory, string> = Object.fromEntries(
  CASH_FLOW_CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
) as Record<CashFlowCategory, string>;

export const CASH_FLOW_VALUE_BY_LABEL: Record<string, CashFlowCategory> = Object.fromEntries(
  CASH_FLOW_CATEGORY_OPTIONS.map((o) => [o.label.toLowerCase(), o.value]),
);
