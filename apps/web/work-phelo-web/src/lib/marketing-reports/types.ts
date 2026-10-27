import { api } from '@/lib/api';
import { exportToCsv } from '@/lib/exportCsv';
import type { ProspectingSettingSlug } from '@/types/marketing';

export type ReportSection = 'crm' | 'campaign' | 'transport';

export interface SelectOption {
  value: string;
  label: string;
}

/** What a report asks for before it can run. Values are kept as strings, keyed by `key`. */
export type ReportFilter =
  | { kind: 'dateRange'; label: string }
  | { kind: 'year'; label: string }
  | { kind: 'select'; key: string; label: string; options: SelectOption[] }
  | { kind: 'rep'; key: 'rep'; label: string }
  | { kind: 'stage'; key: 'stage'; label: string }
  | { kind: 'marketer'; key: 'marketer'; label: string }
  /** A CRM setting list: products, source types, business types. Value is the option's id. */
  | { kind: 'setting'; key: string; label: string; slug: ProspectingSettingSlug }
  /** The target report's own pickers: shown only when the caller has a choice to make. */
  | { kind: 'targetRep'; key: 'rep'; label: string }
  | { kind: 'branch'; key: 'branch'; label: string }
  | { kind: 'department'; key: 'department'; label: string };

export type ReportValues = Record<string, string>;

export interface ReportColumn {
  label: string;
  /** Numbers read better right-aligned. */
  align?: 'left' | 'right';
}

export interface ReportTable {
  title: string;
  description?: string;
  columns: ReportColumn[];
  /** What the screen shows. */
  rows: string[][];
  /** What the CSV holds when it should differ from the screen (raw numbers, no separators). */
  csvRows?: (string | number)[][];
  /** A totals row, shown under the data and added to the CSV. */
  footer?: string[];
}

export interface ReportResult {
  /** Lines under the title: the period, the filters applied. */
  subtitle: string[];
  stats: { label: string; value: string }[];
  tables: ReportTable[];
}

export interface ReportDefinition {
  key: string;
  section: ReportSection;
  title: string;
  description: string;
  filters: ReportFilter[];
  /** Open to every Marketing user, not only those who can see the section's dashboard. */
  open?: boolean;
  run: (values: ReportValues) => Promise<ReportResult>;
}

/** The filter values a report starts with: this month so far, this year. */
export function defaultValues(filters: ReportFilter[]): ReportValues {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const values: ReportValues = {};
  for (const filter of filters) {
    if (filter.kind === 'dateRange') {
      values.from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      values.to = today;
    } else if (filter.kind === 'year') values.year = String(now.getFullYear());
    else values[filter.key] = '';
  }
  return values;
}

/** Reads every page of a paged list endpoint. Reports need the whole set, not one page of it. */
export async function fetchAll<T>(
  endpoint: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page++) {
    const res = await api.get<{ data: T[]; meta: { totalPages: number } }>(endpoint, {
      params: { ...params, page, limit: 100 },
    });
    rows.push(...res.data.data);
    if (page >= res.data.meta.totalPages) return rows;
  }
}

/** Every table of the report in one CSV, one under the other. */
export function exportReportCsv(filename: string, result: ReportResult) {
  const [first, ...rest] = result.tables;
  if (!first) return;
  const body = (t: ReportTable) => [...(t.csvRows ?? t.rows), ...(t.footer ? [t.footer] : [])];
  const rows: (string | number)[][] = [...body(first)];
  for (const t of rest)
    rows.push(
      [],
      [t.title],
      t.columns.map((c) => c.label),
      ...body(t),
    );
  exportToCsv(
    filename,
    first.columns.map((c) => c.label),
    rows,
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The twelve calendar months of a year as inclusive date ranges. */
export function monthBuckets(year: number) {
  return MONTHS.map((label, i) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const last = new Date(year, i + 1, 0).getDate();
    return {
      label,
      fromDate: `${year}-${pad(i + 1)}-01`,
      toDate: `${year}-${pad(i + 1)}-${pad(last)}`,
    };
  });
}

export const num = (value: string | number | null | undefined) => Number(value ?? 0);

export function percent(part: number, whole: number): string {
  return whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—';
}

export function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function changeText(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? '0%' : '—';
  const change = ((current - previous) / previous) * 100;
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
}

export function rangeText(values: ReportValues): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${fmt(values.from)} – ${fmt(values.to)}`;
}
