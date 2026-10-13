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

/** The "Basic" template folds classifications and parent accounts into the same sheet as
 *  accounts — one row per account, with the classification/parent name only needed the first
 *  time that code appears in the file. */
export const BASIC_ACCOUNT_IMPORT_HEADERS = [
  'Account Code',
  'Account Name',
  'Account Type',
  'Classification Code',
  'Classification Name',
  'Parent Account Code',
  'Parent Account Name',
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

/** Mirrors the numbering blocks the accounting service enforces per account type
 *  (CATEGORY_CODE_RANGES in accounting-master-data.service.ts). */
export const CATEGORY_CODE_RANGES: Record<GLAccountCategory, { min: number; max: number }> = {
  ASSET: { min: 1000, max: 1999 },
  LIABILITY: { min: 2000, max: 2999 },
  EQUITY: { min: 3000, max: 3999 },
  REVENUE: { min: 4000, max: 4999 },
  EXPENSE: { min: 5000, max: 5999 },
};

/** The range an all-numeric code falls outside of, or undefined when it's in range (or isn't
 *  numeric / has no known type, which other checks report). */
export function outOfRangeFor(
  code: string,
  category: GLAccountCategory | undefined,
): { min: number; max: number } | undefined {
  if (!category || !/^\d+$/.test(code.trim())) return undefined;
  const range = CATEGORY_CODE_RANGES[category];
  const numeric = Number(code.trim());
  return numeric < range.min || numeric > range.max ? range : undefined;
}

/** The block of codes a parent code reserves for its children, from its trailing zeros
 *  (1100 -> 1100-1199, 1110 -> 1110-1119). Mirrors `codeBand` in the accounting service. */
export function codeBandFor(parentCode: string): { start: number; end: number } | undefined {
  const trimmed = parentCode.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const numeric = Number(trimmed);
  let width = 1;
  while (width < 1000 && numeric % (width * 10) === 0) width *= 10;
  return { start: numeric, end: numeric + width - 1 };
}

/** The message for a code outside its parent's band, or undefined when it fits (or either code
 *  isn't numeric, which is reported separately). */
export function bandProblem(code: string, parentCode: string): string | undefined {
  const band = codeBandFor(parentCode);
  if (!band || !/^\d+$/.test(code.trim())) return undefined;
  const numeric = Number(code.trim());
  return numeric < band.start || numeric > band.end
    ? `Code must be between ${band.start} and ${band.end} to stay within parent code ${parentCode.trim()}`
    : undefined;
}
