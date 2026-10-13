/** Mirrors the HR report builder API (hr-service `src/reports`). */

export type ReportType = 'TABLE' | 'CHART';

export type ChartType =
  | 'BAR'
  | 'BAR_HORIZONTAL'
  | 'BAR_STACKED'
  | 'LINE'
  | 'AREA'
  | 'PIE'
  | 'DONUT'
  | 'SCATTER';

export type Aggregation = 'count' | 'sum' | 'avg' | 'min' | 'max';
export type Granularity = 'day' | 'month' | 'quarter' | 'year';
export type ReportFieldKind = 'category' | 'date' | 'number' | 'text';

/** The key a measure uses for "count of records". */
export const COUNT_FIELD = '__count';

export interface ReportCatalogField {
  key: string;
  label: string;
  kind: ReportFieldKind;
}

export interface ReportCatalogDataset {
  key: string;
  label: string;
  description: string;
  dateField: string;
  fields: ReportCatalogField[];
}

export interface ReportCatalog {
  datasets: ReportCatalogDataset[];
  chartTypes: ChartType[];
  aggregations: Aggregation[];
  granularities: Granularity[];
  maxChartMeasures: number;
  maxBlocksPerReport: number;
}

export interface ReportMeasure {
  field: string;
  aggregation: Aggregation;
}

export interface ReportBlock {
  dataset: string;
  title?: string;
  // Table
  columns?: string[];
  sort?: { field: string; direction: 'asc' | 'desc' };
  // Chart
  chartType?: ChartType;
  groupBy?: { field: string; granularity?: Granularity };
  measures?: ReportMeasure[];
  scatter?: { x: string; y: string; label?: string };
}

export interface ReportPeriod {
  from?: string;
  to?: string;
}

/** A report as the builder holds it, and as it is saved. */
export interface ReportSpec {
  type: ReportType;
  period: ReportPeriod;
  blocks: ReportBlock[];
}

export interface TableResult {
  type: 'TABLE';
  dataset: string;
  columns: { key: string; label: string; kind: string }[];
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
  groupBy: { key: string; label: string; granularity: Granularity | null } | null;
  measures: { key: string; label: string }[];
  rows: { group: string; values: (number | null)[] }[];
  points?: { label: string | null; x: number; y: number }[];
  truncated: boolean;
}

export type ReportResult = TableResult | ChartResult;

export interface SavedReportSummary {
  id: string;
  name: string;
  description: string | null;
  type: ReportType;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedReport extends SavedReportSummary {
  definition: { period: ReportPeriod | null; blocks: ReportBlock[] };
}
