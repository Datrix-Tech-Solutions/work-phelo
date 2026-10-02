import type {
  FinancialReportAccount,
  GLAccountCategory,
  StatementHierarchyCategory,
} from '@/types/accounting';

/** Any statement response that carries the classification → group → account hierarchy. */
type HierarchyReport = { hierarchy: StatementHierarchyCategory[] };

export type CompareMode = 'none' | 'previous-period' | 'previous-year';

export const COMPARE_LABELS: Record<CompareMode, string> = {
  none: 'No comparison',
  'previous-period': 'Previous period',
  'previous-year': 'Same period last year',
};

const DAY_MS = 86_400_000;

const parseIso = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Same calendar day one year earlier; 29 Feb falls back to 28 Feb. */
function shiftBackOneYear(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const shifted = Date.UTC(year - 1, month - 1, day);
  return new Date(shifted).getUTCMonth() === month - 1 ? shifted : Date.UTC(year - 1, month, 0);
}

export const addDaysIso = (iso: string, days: number) => toIso(parseIso(iso) + days * DAY_MS);
export const sameDayLastYear = (iso: string) => toIso(shiftBackOneYear(iso));

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** The date range the current period is compared against, or null when not comparing. */
export function comparativeRange(fromDate: string, toDate: string, mode: CompareMode) {
  if (mode === 'none') return null;
  if (mode === 'previous-year') {
    return { fromDate: toIso(shiftBackOneYear(fromDate)), toDate: toIso(shiftBackOneYear(toDate)) };
  }
  const from = parseIso(fromDate);
  const [year, month, day] = fromDate.split('-').map(Number);
  // Whole calendar years and months compare to the year or month before, not to an equal
  // run of days (which drifts across leap years and unequal month lengths).
  if (month === 1 && day === 1 && parseIso(toDate) === Date.UTC(year, 12, 0)) {
    return { fromDate: `${year - 1}-01-01`, toDate: `${year - 1}-12-31` };
  }
  if (day === 1 && parseIso(toDate) === Date.UTC(year, month, 0)) {
    return { fromDate: toIso(Date.UTC(year, month - 2, 1)), toDate: toIso(from - DAY_MS) };
  }
  const days = (parseIso(toDate) - from) / DAY_MS + 1;
  const previousTo = from - DAY_MS;
  return { fromDate: toIso(previousTo - (days - 1) * DAY_MS), toDate: toIso(previousTo) };
}

export const toCents = (value: string) => Math.round(Number(value) * 100);

/** Negatives render in brackets, the accounting convention for a loss or credit. */
export function formatCents(cents: number) {
  const text = (Math.abs(cents) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return cents < 0 ? `(${text})` : text;
}

export function formatPercent(value: number | null) {
  if (value === null) return '—';
  const text = `${Math.abs(value).toFixed(1)}%`;
  return value < 0 ? `(${text})` : text;
}

export function variancePercent(current: number, previous: number) {
  return previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100;
}

export type StatementLine = {
  account: FinancialReportAccount;
  current: number;
  previous: number;
};
export type StatementGroup = {
  key: string;
  name: string;
  /** True for the backend's stand-in group (no id) holding accounts that sit directly under a
   *  classification. It has no header or subtotal of its own. */
  isPlaceholder: boolean;
  lines: StatementLine[];
  current: number;
  previous: number;
};
export type StatementClassification = {
  key: string;
  name: string;
  groups: StatementGroup[];
  current: number;
  previous: number;
};

type Side = 'current' | 'previous';
type MutableGroup = {
  key: string;
  name: string;
  isPlaceholder: boolean;
  lines: Map<string, StatementLine>;
};
type MutableClassification = { key: string; name: string; groups: Map<string, MutableGroup> };

/**
 * Merges the current and comparative reports for one category into a single tree, so an
 * account that only had activity in one of the periods still appears with 0 in the other.
 * Rows with no activity in either period are dropped unless `showZero` is set.
 */
export function mergeSection(
  current: HierarchyReport,
  previous: HierarchyReport | undefined,
  category: GLAccountCategory,
  showZero: boolean,
): StatementClassification[] {
  const classifications = new Map<string, MutableClassification>();

  const collect = (report: HierarchyReport | undefined, side: Side) => {
    const section = report?.hierarchy.find((entry) => entry.category === category);
    for (const classification of section?.classifications ?? []) {
      const classificationKey = classification.id ?? classification.code;
      const classificationNode = classifications.get(classificationKey) ?? {
        key: classificationKey,
        name: classification.name,
        groups: new Map<string, MutableGroup>(),
      };
      classifications.set(classificationKey, classificationNode);

      for (const group of classification.groups) {
        const groupKey = group.id ?? group.code;
        const groupNode = classificationNode.groups.get(groupKey) ?? {
          key: groupKey,
          name: group.name,
          isPlaceholder: group.id === null,
          lines: new Map<string, StatementLine>(),
        };
        classificationNode.groups.set(groupKey, groupNode);

        for (const row of group.accounts) {
          const line = groupNode.lines.get(row.account.id) ?? {
            account: row.account,
            current: 0,
            previous: 0,
          };
          line[side] = toCents(row.amount);
          groupNode.lines.set(row.account.id, line);
        }
      }
    }
  };

  collect(current, 'current');
  collect(previous, 'previous');

  const sum = (items: Array<{ current: number; previous: number }>, side: Side) =>
    items.reduce((total, item) => total + item[side], 0);

  return Array.from(classifications.values()).flatMap((classification) => {
    const groups = Array.from(classification.groups.values()).flatMap((group) => {
      const lines = Array.from(group.lines.values()).filter(
        (line) => showZero || line.current !== 0 || line.previous !== 0,
      );
      if (lines.length === 0) return [];
      return [
        {
          key: group.key,
          name: group.name,
          isPlaceholder: group.isPlaceholder,
          lines,
          current: sum(lines, 'current'),
          previous: sum(lines, 'previous'),
        },
      ];
    });
    if (groups.length === 0) return [];
    return [
      {
        key: classification.key,
        name: classification.name,
        groups,
        current: sum(groups, 'current'),
        previous: sum(groups, 'previous'),
      },
    ];
  });
}
