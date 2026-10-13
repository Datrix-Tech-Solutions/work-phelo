import {
  Aggregation,
  COUNT_FIELD,
  ChartType,
  Granularity,
  ReportBlock,
  ReportCatalogDataset,
  ReportCatalogField,
  ReportSpec,
} from '@/types/reports';

/**
 * Rules the builder form follows. They mirror the checks the API makes in
 * hr-service `report-engine.ts`, so the form only offers what the server will accept.
 */

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  BAR: 'Bar',
  BAR_HORIZONTAL: 'Horizontal bar',
  BAR_STACKED: 'Stacked bar',
  LINE: 'Line',
  AREA: 'Area',
  PIE: 'Pie',
  DONUT: 'Donut',
  SCATTER: 'Scatter',
};

export const AGGREGATION_LABELS: Record<Aggregation, string> = {
  count: 'Count',
  sum: 'Total',
  avg: 'Average',
  min: 'Lowest',
  max: 'Highest',
};

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: 'Day',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
};

export const MAX_MEASURES = 2;

export const isOnePointChart = (type?: ChartType) => type === 'PIE' || type === 'DONUT';

const fieldsOfKind = (dataset: ReportCatalogDataset, ...kinds: ReportCatalogField['kind'][]) =>
  dataset.fields.filter((field) => kinds.includes(field.kind));

export const groupableFields = (dataset: ReportCatalogDataset, chartType?: ChartType) =>
  chartType === 'LINE' || chartType === 'AREA'
    ? fieldsOfKind(dataset, 'date')
    : fieldsOfKind(dataset, 'category', 'date');

export const numberFields = (dataset: ReportCatalogDataset) => fieldsOfKind(dataset, 'number');

/** Why a chart type can't be used with this dataset, or null when it can. */
export function chartTypeProblem(dataset: ReportCatalogDataset, chartType: ChartType) {
  if (
    (chartType === 'LINE' || chartType === 'AREA') &&
    fieldsOfKind(dataset, 'date').length === 0
  ) {
    return 'No date field';
  }
  if (chartType === 'SCATTER' && numberFields(dataset).length < 2) {
    return 'Needs two number fields';
  }
  return null;
}

export const defaultGranularity = (): Granularity => 'month';

/** A fresh, empty table block for a dataset. */
export const emptyTableBlock = (dataset: ReportCatalogDataset): ReportBlock => ({
  dataset: dataset.key,
  columns: dataset.fields.slice(0, 4).map((field) => field.key),
});

/** A fresh chart block: a bar chart of the record count, grouped by the first category. */
export function emptyChartBlock(dataset: ReportCatalogDataset): ReportBlock {
  const group = groupableFields(dataset, 'BAR')[0];
  return {
    dataset: dataset.key,
    chartType: 'BAR',
    groupBy: group
      ? {
          field: group.key,
          granularity: group.kind === 'date' ? defaultGranularity() : undefined,
        }
      : undefined,
    measures: [{ field: COUNT_FIELD, aggregation: 'count' }],
  };
}

/** What still needs picking before a block can run, or null when it's ready. */
export function blockProblem(
  block: ReportBlock,
  type: ReportSpec['type'],
  dataset: ReportCatalogDataset | undefined,
): string | null {
  if (!dataset) return 'Pick a dataset.';

  if (type === 'TABLE') {
    return (block.columns?.length ?? 0) === 0 ? 'Pick at least one column.' : null;
  }

  if (!block.chartType) return 'Pick a chart type.';
  if (block.chartType === 'SCATTER') {
    return block.scatter?.x && block.scatter?.y ? null : 'Pick an X and a Y field.';
  }
  if (!block.groupBy?.field) return 'Pick what to group by.';
  const group = dataset.fields.find((field) => field.key === block.groupBy?.field);
  if (group?.kind === 'date' && !block.groupBy.granularity) return 'Pick how to group the date.';
  if ((block.measures?.length ?? 0) === 0) return 'Pick a measure.';
  return null;
}

export const specProblem = (spec: ReportSpec, datasets: ReportCatalogDataset[]) => {
  if (spec.blocks.length === 0) return 'Add something to the report.';
  for (const block of spec.blocks) {
    const problem = blockProblem(
      block,
      spec.type,
      datasets.find((d) => d.key === block.dataset),
    );
    if (problem) return problem;
  }
  return null;
};

export const measureLabel = (
  dataset: ReportCatalogDataset | undefined,
  measure: { field: string; aggregation: Aggregation },
) => {
  if (measure.field === COUNT_FIELD) return 'Number of records';
  const field = dataset?.fields.find((f) => f.key === measure.field);
  return `${AGGREGATION_LABELS[measure.aggregation]} ${(field?.label ?? measure.field).toLowerCase()}`;
};
