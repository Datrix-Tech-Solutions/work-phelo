'use client';

import { useMemo, useState } from 'react';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  BaseCurrencyField,
  useBaseCurrency,
} from '@/components/molecules/accounting/BaseCurrencyField';
import { ReportToolbar } from '@/components/molecules/accounting/ReportToolbar';
import {
  ReportPeriodFields,
  useReportPeriod,
} from '@/components/molecules/accounting/ReportPeriodFields';
import {
  ClosingRow,
  SectionBlock,
  SummaryChip,
} from '@/components/molecules/accounting/StatementBlocks';
import { useCostCentres, useTenant } from '@/hooks';
import { useIncomeStatementReport } from '@/hooks/accounting/useFinancialReports';
import {
  COMPARE_LABELS,
  comparativeRange,
  formatDate,
  mergeSection,
  toCents,
  type CompareMode,
} from '@/lib/accounting/profitAndLoss';
import {
  exportStatementCsv,
  exportStatementPdf,
  type StatementExport,
} from '@/lib/accounting/statementExport';
import { extractError } from '@/lib/extractError';
import { useAuthStore } from '@/store/auth.store';
import { cardClass, cn } from '@/lib/utils';

type AppliedFilters = {
  fromDate: string;
  toDate: string;
  periodLabel: string | null;
  costCentreId: string;
  costCentreLabel: string;
  compare: CompareMode;
  comparative: { fromDate: string; toDate: string } | null;
};

const compareOptions = (Object.keys(COMPARE_LABELS) as CompareMode[]).map((value) => ({
  value,
  label: COMPARE_LABELS[value],
}));

const COLUMN_LABELS = { current: 'Current', previous: 'Comparative' };

export function ProfitAndLossView() {
  const period = useReportPeriod();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  // The statement is summed from base-currency amounts, so that is what it is labelled in.
  const currency = useBaseCurrency();
  const tenantId = useAuthStore((state) => state.user?.tenantId ?? '');
  const { data: tenant } = useTenant(tenantId);
  const [costCentreId, setCostCentreId] = useState('');
  const [compareMode, setCompareMode] = useState<CompareMode>('none');
  const [showZero, setShowZero] = useState(false);
  // Filters are only applied on Generate, so editing a field never refetches on its own.
  const [applied, setApplied] = useState<AppliedFilters | null>(null);

  const { data: costCentres = [] } = useCostCentres();
  const costCentreOptions = useMemo(
    () =>
      costCentres.map((centre) => ({
        value: centre.id,
        label: centre.name,
        sublabel: centre.code,
      })),
    [costCentres],
  );

  const report = useIncomeStatementReport(
    {
      fromDate: applied?.fromDate,
      toDate: applied?.toDate,
      costCentreId: applied?.costCentreId || undefined,
    },
    applied !== null,
  );

  const comparativeReport = useIncomeStatementReport(
    {
      fromDate: applied?.comparative?.fromDate,
      toDate: applied?.comparative?.toDate,
      costCentreId: applied?.costCentreId || undefined,
    },
    applied?.comparative != null,
  );

  const generate = () => {
    if (!period.range) return;
    setFiltersOpen(false);
    const { fromDate, toDate } = period.range;
    const centre = costCentres.find((entry) => entry.id === costCentreId);
    setApplied({
      fromDate,
      toDate,
      periodLabel: period.label,
      costCentreId,
      costCentreLabel: centre ? `${centre.code} — ${centre.name}` : 'All cost centres',
      compare: compareMode,
      comparative:
        compareMode === 'previous-period' && period.previousPeriod
          ? period.previousPeriod
          : comparativeRange(fromDate, toDate, compareMode),
    });
  };

  const data = report.data;
  const comparativeData = comparativeReport.data;
  const compare = applied?.comparative != null;
  const revenue = data ? mergeSection(data, comparativeData, 'REVENUE', showZero) : [];
  const expenses = data ? mergeSection(data, comparativeData, 'EXPENSE', showZero) : [];
  const totals = {
    revenue: {
      current: toCents(data?.totalRevenue ?? '0'),
      previous: toCents(comparativeData?.totalRevenue ?? '0'),
    },
    expenses: {
      current: toCents(data?.totalExpenses ?? '0'),
      previous: toCents(comparativeData?.totalExpenses ?? '0'),
    },
    net: {
      current: toCents(data?.netProfitOrLoss ?? '0'),
      previous: toCents(comparativeData?.netProfitOrLoss ?? '0'),
    },
  };
  const isFetching = report.isFetching || comparativeReport.isFetching;
  const loadError = report.error ?? comparativeReport.error;
  const isLoading = report.isLoading || (compare && comparativeReport.isLoading) || !data;

  const collapsed = applied !== null && !filtersOpen;
  const reportReady = applied !== null && !!data && !isLoading && !isFetching && !loadError;

  const buildExport = (): StatementExport | null => {
    if (!applied || !data) return null;
    const dates = `${formatDate(applied.fromDate)} to ${formatDate(applied.toDate)}`;
    return {
      title: 'Profit & Loss Statement',
      companyName: tenant?.name ?? '',
      currency,
      metaLines: [
        `For the period ${applied.periodLabel ? `${applied.periodLabel} (${dates})` : dates}`,
        ...(applied.comparative
          ? [
              `Compared with ${formatDate(applied.comparative.fromDate)} to ${formatDate(applied.comparative.toDate)} (${COMPARE_LABELS[applied.compare]})`,
            ]
          : []),
        `${applied.costCentreLabel} · ${currency ? `Amounts in ${currency} · ` : ''}Posted entries only`,
      ],
      columnLabels: COLUMN_LABELS,
      sections: [
        {
          title: 'Revenue',
          classifications: revenue,
          totalLabel: 'Total Revenue',
          totals: totals.revenue,
        },
        {
          title: 'Expenses',
          classifications: expenses,
          totalLabel: 'Total Expenses',
          totals: totals.expenses,
        },
      ],
      closing: [
        {
          label: totals.net.current < 0 ? 'Net Loss' : 'Net Profit',
          figures: totals.net,
          tone: totals.net.current < 0 ? 'negative' : 'positive',
        },
      ],
      compare,
      filename: `profit-and-loss_${applied.fromDate}_to_${applied.toDate}`,
    };
  };

  const downloadCsv = () => {
    const payload = buildExport();
    if (payload) exportStatementCsv(payload);
  };

  const downloadPdf = async () => {
    const payload = buildExport();
    if (!payload) return;
    setPdfBusy(true);
    try {
      await exportStatementPdf(payload);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <ReportToolbar
        fields={
          <>
            <ReportPeriodFields period={period} />
            <div className="w-64">
              <SearchSelect
                label="Cost centre"
                placeholder="Cost centre"
                options={costCentreOptions}
                value={costCentreId}
                onChange={setCostCentreId}
                showAllOption
                allLabel="All cost centres"
              />
            </div>
            <BaseCurrencyField currency={currency} />
            <div className="w-56">
              <SearchSelect
                label="Compare with"
                placeholder="Compare with"
                options={compareOptions}
                value={compareMode}
                onChange={(value) => setCompareMode(value as CompareMode)}
                clearable={false}
              />
            </div>
            <label className="flex items-center gap-2 pb-2.5 text-sm text-gray-700 select-none">
              <input
                type="checkbox"
                checked={showZero}
                onChange={(event) => setShowZero(event.target.checked)}
              />
              Show zero balances
            </label>
          </>
        }
        summary={
          applied && (
            <>
              <SummaryChip
                label="Period"
                value={`${applied.periodLabel ? `${applied.periodLabel} · ` : ''}${formatDate(applied.fromDate)} – ${formatDate(applied.toDate)}`}
              />
              <SummaryChip label="Cost centre" value={applied.costCentreLabel} />
              {currency && <SummaryChip label="Currency" value={currency} />}
              <SummaryChip
                label="Compare"
                value={
                  applied.comparative
                    ? `${COMPARE_LABELS[applied.compare]} · ${formatDate(applied.comparative.fromDate)} – ${formatDate(applied.comparative.toDate)}`
                    : 'None'
                }
              />
              {showZero && <SummaryChip label="Zero balances" value="Shown" />}
            </>
          )
        }
        collapsed={collapsed}
        hasReport={applied !== null}
        onToggle={() => setFiltersOpen((open) => !open)}
        onGenerate={generate}
        generateDisabled={
          !period.range || (compareMode === 'previous-period' && period.previousPending)
        }
        generating={isFetching}
        onDownloadPdf={downloadPdf}
        onDownloadCsv={downloadCsv}
        downloadDisabled={!reportReady}
        pdfBusy={pdfBusy}
      />

      {/* Report */}
      {applied === null ? (
        <p className="py-16 text-center text-sm text-gray-400">
          Choose a period and generate the report.
        </p>
      ) : report.isError || comparativeReport.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Unable to load the profit and loss statement: {extractError(loadError)}
        </div>
      ) : isLoading || !data ? (
        <p className="py-16 text-center text-sm text-gray-400">Generating report…</p>
      ) : (
        <div className={cardClass('overflow-hidden')}>
          <header className="px-6 py-6 text-center border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Profit &amp; Loss Statement</h2>
            <p className="mt-1 text-sm text-gray-600">
              {applied.periodLabel ? `${applied.periodLabel} · ` : ''}For the period{' '}
              {formatDate(applied.fromDate)} to {formatDate(applied.toDate)}
            </p>
            {applied.comparative && (
              <p className="mt-1 text-sm text-gray-600">
                Compared with {formatDate(applied.comparative.fromDate)} to{' '}
                {formatDate(applied.comparative.toDate)} ({COMPARE_LABELS[applied.compare]})
              </p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              {applied.costCentreLabel} · {currency ? `Amounts in ${currency} · ` : ''}Posted
              entries only
            </p>
          </header>

          {revenue.length === 0 && expenses.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">
              No posted accounting activity matches this report.
            </p>
          ) : (
            <div className="overflow-x-auto p-4">
              <div className={cn('flex flex-col', compare && 'min-w-[820px]')}>
                <SectionBlock
                  title="Revenue"
                  classifications={revenue}
                  totalLabel="Total Revenue"
                  totals={totals.revenue}
                  compare={compare}
                  currency={currency}
                  columnLabels={COLUMN_LABELS}
                  emptyText="No revenue in this period."
                />
                <div className="h-6" />
                <SectionBlock
                  title="Expenses"
                  classifications={expenses}
                  totalLabel="Total Expenses"
                  totals={totals.expenses}
                  compare={compare}
                  currency={currency}
                  columnLabels={COLUMN_LABELS}
                  emptyText="No expenses in this period."
                />
                <ClosingRow
                  label={totals.net.current < 0 ? 'Net Loss' : 'Net Profit'}
                  current={totals.net.current}
                  previous={totals.net.previous}
                  compare={compare}
                  tone={totals.net.current < 0 ? 'negative' : 'positive'}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
