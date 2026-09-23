import type { GLAccountCategory } from '@/types/accounting';

export const CLASSIFICATION_IMPORT_HEADERS = [
  'Classification Code',
  'Classification Name',
  'Account Type',
] as const;

export const GROUP_IMPORT_HEADERS = [
  'Parent Account Code',
  'Parent Account Name',
  'Classification Code',
] as const;

export const ACCOUNT_IMPORT_HEADERS = [
  'Account Code',
  'Account Name',
  'Account Type',
  'Classification Code',
  'Parent Account Code',
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
