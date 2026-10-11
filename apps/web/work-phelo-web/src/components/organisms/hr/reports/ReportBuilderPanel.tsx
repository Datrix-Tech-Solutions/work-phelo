'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Input } from '@/components/atoms/Input';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { SegmentedToggle } from '@/components/atoms/SegmentedToggle';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import {
  AGGREGATION_LABELS,
  CHART_TYPE_LABELS,
  GRANULARITY_LABELS,
  MAX_MEASURES,
  chartTypeProblem,
  defaultGranularity,
  emptyChartBlock,
  emptyTableBlock,
  groupableFields,
  isOnePointChart,
  numberFields,
  specProblem,
} from '@/lib/hr/reportBuilder';
import { cardClass } from '@/lib/utils';
import {
  Aggregation,
  COUNT_FIELD,
  ChartType,
  Granularity,
  ReportBlock,
  ReportCatalog,
  ReportCatalogDataset,
  ReportMeasure,
  ReportSpec,
  ReportType,
} from '@/types/reports';

const TYPE_OPTIONS: { label: string; value: ReportType }[] = [
  { label: 'Table', value: 'TABLE' },
  { label: 'Charts', value: 'CHART' },
];

const CHART_ORDER: ChartType[] = [
  'BAR',
  'BAR_HORIZONTAL',
  'BAR_STACKED',
  'LINE',
  'AREA',
  'PIE',
  'DONUT',
  'SCATTER',
];

const VALUE_AGGREGATIONS: Aggregation[] = ['sum', 'avg', 'min', 'max'];

const COUNT_MEASURE: ReportMeasure = { field: COUNT_FIELD, aggregation: 'count' };

const newBlock = (type: ReportType, dataset: ReportCatalogDataset): ReportBlock =>
  type === 'TABLE' ? emptyTableBlock(dataset) : emptyChartBlock(dataset);

// ── One measure: a field and how to total it ───────────────────────────────

interface MeasureFieldProps {
  label: string;
  dataset: ReportCatalogDataset;
  value: ReportMeasure;
  onChange: (value: ReportMeasure) => void;
  onRemove?: () => void;
}

function MeasureField({ label, dataset, value, onChange, onRemove }: MeasureFieldProps) {
  const isCount = value.field === COUNT_FIELD;
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-2 gap-2">
        <SearchSelect
          label={label}
          size="md"
          clearable={false}
          options={[
            { value: COUNT_FIELD, label: 'Number of records' },
            ...numberFields(dataset).map((f) => ({ value: f.key, label: f.label })),
          ]}
          value={value.field}
          onChange={(field) =>
            onChange({
              field,
              aggregation: field === COUNT_FIELD ? 'count' : 'sum',
            })
          }
        />
        {isCount ? (
          <div className="self-end pb-3 text-sm text-gray-500">Counted as is</div>
        ) : (
          <SearchSelect
            label="Calculated as"
            size="md"
            clearable={false}
            options={VALUE_AGGREGATIONS.map((a) => ({ value: a, label: AGGREGATION_LABELS[a] }))}
            value={value.aggregation}
            onChange={(aggregation) =>
              onChange({ ...value, aggregation: aggregation as Aggregation })
            }
          />
        )}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="self-start text-xs text-gray-500 hover:text-red-600"
        >
          Remove this comparison
        </button>
      )}
    </div>
  );
}

// ── Dataset picker shared by both block kinds ──────────────────────────────

interface DatasetFieldProps {
  catalog: ReportCatalog;
  value: string;
  onChange: (dataset: ReportCatalogDataset) => void;
}

function DatasetField({ catalog, value, onChange }: DatasetFieldProps) {
  return (
    <SearchSelect
      label="Data"
      size="md"
      clearable={false}
      options={catalog.datasets.map((d) => ({
        value: d.key,
        label: d.label,
        sublabel: d.description,
      }))}
      value={value}
      onChange={(key) => {
        const dataset = catalog.datasets.find((d) => d.key === key);
        if (dataset) onChange(dataset);
      }}
    />
  );
}

// ── Table block ────────────────────────────────────────────────────────────

interface BlockEditorProps {
  catalog: ReportCatalog;
  block: ReportBlock;
  onChange: (block: ReportBlock) => void;
}

function TableBlockEditor({ catalog, block, onChange }: BlockEditorProps) {
  const dataset = catalog.datasets.find((d) => d.key === block.dataset);
  if (!dataset) return null;
  const columns = block.columns ?? [];

  return (
    <div className="flex flex-col gap-4">
      <DatasetField
        catalog={catalog}
        value={block.dataset}
        onChange={(next) => onChange(emptyTableBlock(next))}
      />
      <MultiSelect
        label="Columns"
        size="md"
        placeholder="Pick the columns to show"
        options={dataset.fields.map((f) => ({ value: f.key, label: f.label }))}
        value={columns}
        onChange={(next) =>
          onChange({
            ...block,
            columns: next,
            sort: block.sort && next.includes(block.sort.field) ? block.sort : undefined,
          })
        }
      />
      <div className="grid grid-cols-2 gap-2">
        <SearchSelect
          label="Sort by"
          size="md"
          placeholder="No sorting"
          options={columns.map((key) => ({
            value: key,
            label: dataset.fields.find((f) => f.key === key)?.label ?? key,
          }))}
          value={block.sort?.field ?? ''}
          onChange={(field) =>
            onChange({
              ...block,
              sort: field ? { field, direction: block.sort?.direction ?? 'asc' } : undefined,
            })
          }
        />
        <SearchSelect
          label="Order"
          size="md"
          clearable={false}
          disabled={!block.sort}
          options={[
            { value: 'asc', label: 'Ascending' },
            { value: 'desc', label: 'Descending' },
          ]}
          value={block.sort?.direction ?? 'asc'}
          onChange={(direction) =>
            block.sort &&
            onChange({ ...block, sort: { ...block.sort, direction: direction as 'asc' | 'desc' } })
          }
        />
      </div>
    </div>
  );
}

// ── Chart block ────────────────────────────────────────────────────────────

function ChartBlockEditor({ catalog, block, onChange }: BlockEditorProps) {
  const dataset = catalog.datasets.find((d) => d.key === block.dataset);
  if (!dataset) return null;

  const chartType = block.chartType ?? 'BAR';
  const measures = block.measures ?? [];
  const groups = groupableFields(dataset, chartType);
  const groupField = dataset.fields.find((f) => f.key === block.groupBy?.field);
  const numbers = numberFields(dataset);
  const allowedMeasures = isOnePointChart(chartType) ? 1 : MAX_MEASURES;

  const changeChartType = (next: ChartType) => {
    if (next === 'SCATTER') {
      onChange({
        dataset: block.dataset,
        title: block.title,
        chartType: next,
        scatter: { x: numbers[0]?.key ?? '', y: numbers[1]?.key ?? '' },
      });
      return;
    }
    // Back from scatter, or onto a type that needs a date, the grouping is rebuilt.
    const allowed = groupableFields(dataset, next);
    const keep = allowed.find((f) => f.key === block.groupBy?.field);
    const group = keep ?? allowed[0];
    onChange({
      dataset: block.dataset,
      title: block.title,
      chartType: next,
      scatter: undefined,
      groupBy: group
        ? {
            field: group.key,
            granularity:
              group.kind === 'date'
                ? (block.groupBy?.granularity ?? defaultGranularity())
                : undefined,
          }
        : undefined,
      measures: (measures.length > 0 ? measures : [COUNT_MEASURE]).slice(
        0,
        isOnePointChart(next) ? 1 : MAX_MEASURES,
      ),
    });
  };

  const setMeasure = (index: number, value: ReportMeasure) =>
    onChange({ ...block, measures: measures.map((m, i) => (i === index ? value : m)) });

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Chart title (optional)"
        value={block.title ?? ''}
        maxLength={120}
        onChange={(e) => onChange({ ...block, title: e.target.value || undefined })}
      />
      <DatasetField
        catalog={catalog}
        value={block.dataset}
        onChange={(next) => onChange({ ...emptyChartBlock(next), title: block.title })}
      />
      <SearchSelect
        label="Chart type"
        size="md"
        clearable={false}
        options={CHART_ORDER.filter((t) => catalog.chartTypes.includes(t)).map((t) => {
          const problem = chartTypeProblem(dataset, t);
          return {
            value: t,
            label: CHART_TYPE_LABELS[t],
            disabled: problem !== null,
            tag: problem ?? undefined,
          };
        })}
        value={chartType}
        onChange={(next) => changeChartType(next as ChartType)}
      />

      {chartType === 'SCATTER' ? (
        <>
          <SearchSelect
            label="X axis"
            size="md"
            clearable={false}
            options={numbers.map((f) => ({ value: f.key, label: f.label }))}
            value={block.scatter?.x ?? ''}
            onChange={(x) =>
              onChange({ ...block, scatter: { ...(block.scatter ?? { y: '' }), x } })
            }
          />
          <SearchSelect
            label="Y axis"
            size="md"
            clearable={false}
            options={numbers.map((f) => ({ value: f.key, label: f.label }))}
            value={block.scatter?.y ?? ''}
            onChange={(y) =>
              onChange({ ...block, scatter: { ...(block.scatter ?? { x: '' }), y } })
            }
          />
          <SearchSelect
            label="Label each point with (optional)"
            size="md"
            options={dataset.fields
              .filter((f) => f.kind === 'text' || f.kind === 'category')
              .map((f) => ({ value: f.key, label: f.label }))}
            value={block.scatter?.label ?? ''}
            onChange={(label) =>
              block.scatter &&
              onChange({ ...block, scatter: { ...block.scatter, label: label || undefined } })
            }
          />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <SearchSelect
              label="Group by"
              size="md"
              clearable={false}
              options={groups.map((f) => ({ value: f.key, label: f.label }))}
              value={block.groupBy?.field ?? ''}
              onChange={(field) => {
                const picked = groups.find((f) => f.key === field);
                onChange({
                  ...block,
                  groupBy: {
                    field,
                    granularity:
                      picked?.kind === 'date'
                        ? (block.groupBy?.granularity ?? defaultGranularity())
                        : undefined,
                  },
                });
              }}
            />
            {groupField?.kind === 'date' && (
              <SearchSelect
                label="Per"
                size="md"
                clearable={false}
                options={(['day', 'month', 'quarter', 'year'] as Granularity[]).map((g) => ({
                  value: g,
                  label: GRANULARITY_LABELS[g],
                }))}
                value={block.groupBy?.granularity ?? defaultGranularity()}
                onChange={(granularity) =>
                  block.groupBy &&
                  onChange({
                    ...block,
                    groupBy: { ...block.groupBy, granularity: granularity as Granularity },
                  })
                }
              />
            )}
          </div>

          {measures.map((measure, index) => (
            <MeasureField
              key={index}
              label={index === 0 ? 'Measure' : 'Compare with'}
              dataset={dataset}
              value={measure}
              onChange={(value) => setMeasure(index, value)}
              onRemove={
                index > 0
                  ? () => onChange({ ...block, measures: measures.filter((_, i) => i !== index) })
                  : undefined
              }
            />
          ))}
          {measures.length < allowedMeasures && (
            <button
              type="button"
              className="self-start text-sm font-medium text-(--module-btn-bg,var(--color-brand)) hover:underline"
              onClick={() =>
                onChange({
                  ...block,
                  measures: [...measures, COUNT_MEASURE],
                })
              }
            >
              + Compare with another measure
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── The panel ──────────────────────────────────────────────────────────────

interface ReportBuilderPanelProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: ReportCatalog | undefined;
  /** The report on the page now; the form starts from it. */
  initial: ReportSpec | null;
  onGenerate: (spec: ReportSpec) => void;
}

export function ReportBuilderPanel({
  isOpen,
  onClose,
  catalog,
  initial,
  onGenerate,
}: ReportBuilderPanelProps) {
  const [spec, setSpec] = useState<ReportSpec | null>(null);

  // Each time the panel opens it starts from the report on the page, or a fresh table.
  useEffect(() => {
    if (!isOpen || !catalog) return;
    if (initial) {
      setSpec(structuredClone(initial));
      return;
    }
    const first = catalog.datasets[0];
    setSpec(first ? { type: 'TABLE', period: {}, blocks: [emptyTableBlock(first)] } : null);
    // Only on open: edits to the page's report while the panel is shut don't matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const problem =
    spec && catalog ? specProblem(spec, catalog.datasets) : 'Nothing to generate yet.';

  const changeType = (type: ReportType) => {
    if (!spec || !catalog || spec.type === type) return;
    const first =
      catalog.datasets.find((d) => d.key === spec.blocks[0]?.dataset) ?? catalog.datasets[0];
    if (first) setSpec({ ...spec, type, blocks: [newBlock(type, first)] });
  };

  const setBlock = (index: number, block: ReportBlock) =>
    spec && setSpec({ ...spec, blocks: spec.blocks.map((b, i) => (i === index ? block : b)) });

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Generate report"
      description="Choose what to see. Everything is calculated from live HR data."
      width="sm:w-[520px]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">{problem ?? ''}</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!!problem}
              onClick={() => {
                if (!spec) return;
                onGenerate(spec);
                onClose();
              }}
            >
              Generate
            </Button>
          </div>
        </div>
      }
    >
      {!catalog || !spec ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : catalog.datasets.length === 0 ? (
        <p className="text-sm text-gray-500">There is no data you can report on yet.</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-gray-900">Show me</span>
            <SegmentedToggle value={spec.type} onChange={changeType} options={TYPE_OPTIONS} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <DatePicker
              label="From"
              value={spec.period.from}
              maxDate={spec.period.to}
              onChange={(from) =>
                setSpec({ ...spec, period: { ...spec.period, from: from || undefined } })
              }
            />
            <DatePicker
              label="To"
              value={spec.period.to}
              minDate={spec.period.from}
              onChange={(to) =>
                setSpec({ ...spec, period: { ...spec.period, to: to || undefined } })
              }
            />
          </div>

          {spec.type === 'TABLE' ? (
            <TableBlockEditor
              catalog={catalog}
              block={spec.blocks[0]}
              onChange={(block) => setBlock(0, block)}
            />
          ) : (
            <>
              {spec.blocks.map((block, index) => (
                <div key={index} className={cardClass('flex flex-col gap-4 p-4')}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">Chart {index + 1}</span>
                    {spec.blocks.length > 1 && (
                      <button
                        type="button"
                        className="text-xs text-gray-500 hover:text-red-600"
                        onClick={() =>
                          setSpec({ ...spec, blocks: spec.blocks.filter((_, i) => i !== index) })
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <ChartBlockEditor
                    catalog={catalog}
                    block={block}
                    onChange={(next) => setBlock(index, next)}
                  />
                </div>
              ))}
              {spec.blocks.length < catalog.maxBlocksPerReport && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const dataset =
                      catalog.datasets.find((d) => d.key === spec.blocks.at(-1)?.dataset) ??
                      catalog.datasets[0];
                    setSpec({ ...spec, blocks: [...spec.blocks, emptyChartBlock(dataset)] });
                  }}
                >
                  Add another chart
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </SidePanel>
  );
}
