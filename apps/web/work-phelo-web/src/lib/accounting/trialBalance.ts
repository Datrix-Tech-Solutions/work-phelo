import { toCents } from '@/lib/accounting/profitAndLoss';
import type {
  FinancialReportAccount,
  GLAccountCategory,
  TrialBalanceReport,
} from '@/types/accounting';

/** The order a trial balance lists its categories in. */
const CATEGORY_ORDER: GLAccountCategory[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

const CATEGORY_TITLES: Record<GLAccountCategory, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expenses',
};

export type TrialLine = { account: FinancialReportAccount; debit: number; credit: number };
export type TrialGroup = {
  key: string;
  code: string;
  name: string;
  lines: TrialLine[];
  debit: number;
  credit: number;
};
export type TrialCategory = {
  category: GLAccountCategory;
  title: string;
  groups: TrialGroup[];
  debit: number;
  credit: number;
};

const byCode = (a: { code: string }, b: { code: string }) =>
  a.code.localeCompare(b.code, undefined, { numeric: true });

/**
 * Groups the report's accounts into category → account group → account, everything sorted by
 * code, with debit and credit subtotals (in cents) at the group and category level.
 * Categories with no accounts are left out.
 */
export function buildTrialCategories(report: TrialBalanceReport): TrialCategory[] {
  return CATEGORY_ORDER.flatMap((category) => {
    const groups = new Map<string, TrialGroup>();
    for (const entry of report.accounts[category] ?? []) {
      const { accountGroup } = entry.account;
      const key = accountGroup.id ?? accountGroup.code;
      const group = groups.get(key) ?? {
        key,
        code: accountGroup.code,
        name: accountGroup.name,
        lines: [],
        debit: 0,
        credit: 0,
      };
      const line = {
        account: entry.account,
        debit: toCents(entry.debitBalance),
        credit: toCents(entry.creditBalance),
      };
      group.lines.push(line);
      group.debit += line.debit;
      group.credit += line.credit;
      groups.set(key, group);
    }
    if (groups.size === 0) return [];

    const sorted = Array.from(groups.values())
      .sort(byCode)
      .map((group) => ({
        ...group,
        lines: [...group.lines].sort((a, b) => byCode(a.account, b.account)),
      }));
    return [
      {
        category,
        title: CATEGORY_TITLES[category],
        groups: sorted,
        debit: sorted.reduce((sum, group) => sum + group.debit, 0),
        credit: sorted.reduce((sum, group) => sum + group.credit, 0),
      },
    ];
  });
}
