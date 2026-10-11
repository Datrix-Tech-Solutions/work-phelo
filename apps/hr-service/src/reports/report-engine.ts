import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ReportDataset,
  ReportField,
  ReportRow,
  ReportValue,
  getReportDataset,
} from './report-catalog';

/**
 * Validates a report block against the catalog and turns loaded rows into table rows or chart
 * series. Pure: no database, no request, so every rule here is covered by plain unit tests.
 */

export const REPORT_TYPES = ['TABLE', 'CHART'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const CHART_TYPES = [
  'BAR',
  'BAR_HORIZONTAL',
  'BAR_STACKED',
  'LINE',
  'AREA',
  'PIE',
  'DONUT',
  'SCATTER',
] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export const AGGREGATIONS = ['count', 'sum', 'avg', 'min', 'max'] as const;
export type Aggregation = (typeof AGGREGATIONS)[number];

export const GRANULARITIES = ['day', 'month', 'quarter', 'year'] as const;
export type Granularity = (typeof GRANULARITIES)[number];

/** The key a block uses for "count of records". It is not a catalog field. */
export const COUNT_FIELD = '__count';

export const MAX_CHART_MEASURES = 2;
export const MAX_BLOCKS_PER_REPORT = 12;
export const MAX_TABLE_COLUMNS = 20;
export const MAX_SCATTER_POINTS = 2_000;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export interface ReportBlock {
  dataset: string;
  title?: string;
  // Table blocks
  columns?: string[];
  sort?: { field: string; direction: 'asc' | 'desc' };
  // Chart blocks
  chartType?: ChartType;
  groupBy?: { field: string; granularity?: Granularity };
  measures?: { field: string; aggregation: Aggregation }[];
  scatter?: { x: string; y: string; label?: string };
  // Any block
  filters?: { field: string; values: string[] }[];
}

export type CanUse = (rule: string) => boolean;

export type ReportColumn = { key: string; label: string; kind: string };

export interface TableResult {
  type: 'TABLE';
  dataset: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  total: number;
  page: number;
  pageSize: number;
  truncated: boolean;
}

export interface ChartResult {
  type: 'CHART';
  dataset: string;
  chartType: ChartType;
  groupBy: {
    key: string;
    label: string;
    granularity: Granularity | null;
  } | null;
  measures: { key: string; label: string }[];
  /** One row per group, with one value per measure in `measures` order. */
  rows: { group: string; values: (number | null)[] }[];
  /** Scatter only: one point per record. */
  points?: { label: string | null; x: number; y: number }[];
  truncated: boolean;
}

export type ReportResult = TableResult | ChartResult;

const bad = (message: string): never => {
  throw new BadRequestException(message);
};

const fieldMap = (dataset: ReportDataset) =>
  new Map(dataset.fields.map((field) => [field.key, field]));

const requireField = (
  fields: Map<string, ReportField>,
  key: string,
  what: string,
  canUse: CanUse,
): ReportField => {
  const field = fields.get(key);
  if (!field) return bad(`Unknown field "${key}" used as ${what}.`);
  if (field.requires && !canUse(field.requires)) {
    throw new ForbiddenException(
      `You don't have permission to use the "${field.label}" field.`,
    );
  }
  return field;
};

/** Datasets and fields this user may use. Powers the catalog endpoint the form is built from. */
export function describeCatalog(
  datasets: readonly ReportDataset[],
  canUse: CanUse,
) {
  return datasets
    .filter((dataset) => !dataset.requires || canUse(dataset.requires))
    .map((dataset) => ({
      key: dataset.key,
      label: dataset.label,
      description: dataset.description,
      dateField: dataset.dateField,
      fields: dataset.fields
        .filter((field) => !field.requires || canUse(field.requires))
        .map(({ key, label, kind }) => ({ key, label, kind })),
    }));
}

/**
 * Checks a block is something the catalog allows and the user may run, and returns the dataset
 * it reads. Throws a 400 (or 403 for permissions) with a message the form can show.
 */
export function validateBlock(
  block: ReportBlock,
  reportType: ReportType,
  canUse: CanUse,
): ReportDataset {
  const dataset = getReportDataset(block.dataset);
  if (!dataset) return bad(`Unknown dataset "${block.dataset}".`);
  if (dataset.requires && !canUse(dataset.requires)) {
    throw new ForbiddenException(
      `You don't have permission to report on ${dataset.label}.`,
    );
  }
  const fields = fieldMap(dataset);

  for (const filter of block.filters ?? []) {
    const field = requireField(fields, filter.field, 'a filter', canUse);
    if (field.kind !== 'category') {
      bad(`"${field.label}" can't be used as a filter.`);
    }
  }

  if (reportType === 'TABLE') {
    if (block.chartType || block.groupBy || block.measures || block.scatter) {
      bad('A table report can only hold table blocks.');
    }
    const columns = block.columns ?? [];
    if (columns.length === 0) bad('Pick at least one column for the table.');
    if (columns.length > MAX_TABLE_COLUMNS) {
      bad(`A table can have at most ${MAX_TABLE_COLUMNS} columns.`);
    }
    if (new Set(columns).size !== columns.length) {
      bad('Each column can only be added once.');
    }
    for (const key of columns) requireField(fields, key, 'a column', canUse);
    if (block.sort) {
      requireField(fields, block.sort.field, 'the sort', canUse);
      if (!columns.includes(block.sort.field)) {
        bad('Sort by one of the columns in the table.');
      }
    }
    return dataset;
  }

  // Chart blocks.
  if (block.columns || block.sort) {
    bad('A chart report can only hold chart blocks.');
  }
  const chartType = block.chartType;
  if (!chartType) return bad('Pick a chart type.');

  if (chartType === 'SCATTER') {
    if (!block.scatter) return bad('A scatter chart needs an X and a Y field.');
    const x = requireField(fields, block.scatter.x, 'the X axis', canUse);
    const y = requireField(fields, block.scatter.y, 'the Y axis', canUse);
    if (x.kind !== 'number' || y.kind !== 'number') {
      bad('A scatter chart compares two number fields.');
    }
    if (block.scatter.label) {
      requireField(fields, block.scatter.label, 'the point label', canUse);
    }
    return dataset;
  }

  if (!block.groupBy) return bad('Pick what to group the chart by.');
  const group = requireField(
    fields,
    block.groupBy.field,
    'the group-by',
    canUse,
  );
  if (group.kind !== 'category' && group.kind !== 'date') {
    bad(`"${group.label}" can't be used to group a chart.`);
  }
  if (group.kind === 'date' && !block.groupBy.granularity) {
    bad(`Pick how to group "${group.label}" (day, month, quarter or year).`);
  }
  if (group.kind === 'category' && block.groupBy.granularity) {
    bad(`"${group.label}" isn't a date, so it has no granularity.`);
  }
  if ((chartType === 'LINE' || chartType === 'AREA') && group.kind !== 'date') {
    bad('Line and area charts need a date to group by.');
  }

  const measures = block.measures ?? [];
  if (measures.length === 0) bad('Pick at least one measure.');
  if (measures.length > MAX_CHART_MEASURES) {
    bad(`A chart can compare at most ${MAX_CHART_MEASURES} measures.`);
  }
  if ((chartType === 'PIE' || chartType === 'DONUT') && measures.length !== 1) {
    bad('Pie and donut charts take exactly one measure.');
  }
  for (const measure of measures) {
    if (measure.field === COUNT_FIELD) {
      if (measure.aggregation !== 'count') {
        bad('Counting records can only be done with the count aggregation.');
      }
      continue;
    }
    const field = requireField(fields, measure.field, 'a measure', canUse);
    if (field.kind !== 'number') {
      bad(`"${field.label}" is not a number, so it can't be measured.`);
    }
    if (measure.aggregation === 'count') {
      bad(`Use "Count of records" instead of counting "${field.label}".`);
    }
  }
  return dataset;
}

// ── Running ────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

/** The group a date falls in. Zero-padded so the labels sort in date order as plain strings. */
export function dateBucket(date: Date, granularity: Granularity): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  switch (granularity) {
    case 'year':
      return String(year);
    case 'quarter':
      return `${year}-Q${Math.ceil(month / 3)}`;
    case 'month':
      return `${year}-${pad(month)}`;
    case 'day':
      return `${year}-${pad(month)}-${pad(date.getUTCDate())}`;
  }
}

const asNumber = (value: ReportValue): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const round2 = (value: number) => Math.round(value * 100) / 100;

function aggregate(
  rows: ReportRow[],
  field: string,
  aggregation: Aggregation,
): number | null {
  if (aggregation === 'count') return rows.length;
  const values = rows
    .map((row) => asNumber(row[field]))
    .filter((value): value is number => value !== null);
  // No figures at all is "no data", which is different from a total of zero.
  if (values.length === 0) return null;
  switch (aggregation) {
    case 'sum':
      return round2(values.reduce((total, value) => total + value, 0));
    case 'avg':
      return round2(
        values.reduce((total, value) => total + value, 0) / values.length,
      );
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
  }
}

const measureLabel = (
  dataset: ReportDataset,
  measure: { field: string; aggregation: Aggregation },
) => {
  if (measure.field === COUNT_FIELD) return 'Number of records';
  const field = dataset.fields.find((f) => f.key === measure.field);
  const name = field?.label ?? measure.field;
  const verb: Record<Aggregation, string> = {
    count: 'Count',
    sum: 'Total',
    avg: 'Average',
    min: 'Lowest',
    max: 'Highest',
  };
  return `${verb[measure.aggregation]} ${name.toLowerCase()}`;
};

const cellText = (value: ReportValue): string | number | null => {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value;
};

/** Orders two cells; empty cells are the caller's concern (they always sort last). */
const compare = (a: ReportValue, b: ReportValue) => {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
};

const compareForSort = (
  a: ReportValue,
  b: ReportValue,
  direction: 'asc' | 'desc',
) => {
  // Empty cells go last whichever way the table is sorted, so they never lead the page.
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (direction === 'desc' ? -1 : 1) * compare(a, b);
};

function applyFilters(rows: ReportRow[], block: ReportBlock): ReportRow[] {
  const filters = (block.filters ?? []).filter((f) => f.values.length > 0);
  if (filters.length === 0) return rows;
  return rows.filter((row) =>
    filters.every((filter) =>
      filter.values.includes(String(row[filter.field] ?? '')),
    ),
  );
}

export function runBlock(
  dataset: ReportDataset,
  rawRows: ReportRow[],
  block: ReportBlock,
  options: { page?: number; pageSize?: number; truncated: boolean },
): ReportResult {
  const rows = applyFilters(rawRows, block);
  const fields = fieldMap(dataset);

  if (!block.chartType) {
    // Table
    const columns = (block.columns ?? []).map(
      (key) => fields.get(key) as ReportField,
    );
    let ordered = rows;
    if (block.sort) {
      const { field, direction } = block.sort;
      ordered = [...rows].sort((a, b) =>
        compareForSort(a[field], b[field], direction),
      );
    }
    const pageSize = Math.min(
      options.pageSize ?? DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );
    const page = Math.max(options.page ?? 1, 1);
    const slice = ordered.slice((page - 1) * pageSize, page * pageSize);
    return {
      type: 'TABLE',
      dataset: dataset.key,
      columns: columns.map(({ key, label, kind }) => ({ key, label, kind })),
      rows: slice.map((row) =>
        Object.fromEntries(columns.map((c) => [c.key, cellText(row[c.key])])),
      ),
      total: ordered.length,
      page,
      pageSize,
      truncated: options.truncated,
    };
  }

  const chartType = block.chartType;

  if (chartType === 'SCATTER' && block.scatter) {
    const { x, y, label: labelField } = block.scatter;
    const points = rows
      .map((row) => ({
        label: labelField ? String(cellText(row[labelField]) ?? '') : null,
        x: asNumber(row[x]),
        y: asNumber(row[y]),
      }))
      .filter(
        (point): point is { label: string | null; x: number; y: number } =>
          point.x !== null && point.y !== null,
      )
      .slice(0, MAX_SCATTER_POINTS);
    return {
      type: 'CHART',
      dataset: dataset.key,
      chartType,
      groupBy: null,
      measures: [
        { key: x, label: fields.get(x)?.label ?? x },
        { key: y, label: fields.get(y)?.label ?? y },
      ],
      rows: [],
      points,
      truncated: options.truncated || rows.length > MAX_SCATTER_POINTS,
    };
  }

  const groupBy = block.groupBy as NonNullable<ReportBlock['groupBy']>;
  const measures = block.measures ?? [];
  const groupField = fields.get(groupBy.field) as ReportField;
  const granularity = groupBy.granularity ?? null;

  const groups = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const raw = row[groupBy.field];
    // A record with no date can't be placed on a timeline, so it's left out of date groupings.
    if (granularity && !(raw instanceof Date)) continue;
    const key = granularity
      ? dateBucket(raw as Date, granularity)
      : String(cellText(raw) ?? 'Not set');
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const result = [...groups.entries()].map(([group, groupRows]) => ({
    group,
    values: measures.map((m) =>
      m.field === COUNT_FIELD
        ? groupRows.length
        : aggregate(groupRows, m.field, m.aggregation),
    ),
  }));

  if (groupField.kind === 'date') {
    result.sort((a, b) => a.group.localeCompare(b.group));
  } else {
    // Biggest first reads best for bars and pies; ties fall back to the name.
    result.sort(
      (a, b) =>
        (b.values[0] ?? -Infinity) - (a.values[0] ?? -Infinity) ||
        a.group.localeCompare(b.group),
    );
  }

  return {
    type: 'CHART',
    dataset: dataset.key,
    chartType,
    groupBy: { key: groupField.key, label: groupField.label, granularity },
    measures: measures.map((m) => ({
      key:
        m.field === COUNT_FIELD ? COUNT_FIELD : `${m.aggregation}:${m.field}`,
      label: measureLabel(dataset, m),
    })),
    rows: result,
    truncated: options.truncated,
  };
}
