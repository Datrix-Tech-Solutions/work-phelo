'use client';

import { useState } from 'react';
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
import { useTenant } from '@/hooks';
import {
  useBalanceSheetReport,
  useIncomeStatementReport,
} from '@/hooks/accounting/useFinancialReports';
import {
  BALANCE_COMPARE_LABELS,
  comparativeAsOf,
  fiscalYearStart,
  type BalanceCompareMode,
} from '@/lib/accounting/balanceSheet';
import { formatCents, formatDate, mergeSection, toCents } from '@/lib/accounting/profitAndLoss';
import {
  exportStatementCsv,
  exportStatementPdf,
  type ExtraRow,
  type StatementExport,
} from '@/lib/accounting/statementExport';
import { extractError } from '@/lib/extractError';
import { cardClass, cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

type AppliedFilters = {
  asOfDate: string;
  periodLabel: string | null;
  /** Profit is added to equity from here (the start of the fiscal year) up to `asOfDate`. */
  yearStart: string;
  compare: BalanceCompareMode;
  comparativeAsOf: string | null;
  comparativeYearStart: string | null;
};

const compareOptions = (Object.keys(BALANCE_COMPARE_LABELS) as BalanceCompareMode[]).map(
  (value) => ({ value, label: BALANCE_COMPARE_LABELS[value] }),
);

const PROFIT_LABEL = 'Current period profit / (loss)';

export function BalanceSheetView() {
  const period = useReportPeriod({ asAt: true });
  const [pdfBusy, setPdfBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const currency = useBaseCurrency();
  const tenantId = useAuthStore((state) => state.user?.tenantId ?? '');
  const { data: tenant } = useTenant(tenantId);
  const [compareMode, setCompareMode] = useState<BalanceCompareMode>('none');
  // Filters are only applied on Generate, so editing a field never refetches on its own.
  const [applied, setApplied] = useState<AppliedFilters | null>(null);

  const hasComparative = applied?.comparativeAsOf != null;

  const report = useBalanceSheetReport({ asOfDate: applied?.asOfDate }, applied !== null);
  // The balance sheet only sums equity accounts, so profit not yet closed into retained
  // earnings is missing from it. It is fetched here and shown as its own line in equity.
  const profit = useIncomeStatementReport(
    { fromDate: applied?.yearStart, toDate: applied?.asOfDate },
    applied !== null,
  );
  const comparativeReport = useBalanceSheetReport(
    { asOfDate: applied?.comparativeAsOf ?? undefined },
    hasComparative,
  );
  const comparativeProfit = useIncomeStatementReport(
    {
      fromDate: applied?.comparativeYearStart ?? undefined,
      toDate: applied?.comparativeAsOf ?? undefined,
    },
    hasComparative,
  );

  const generate = () => {
    if (!period.asOfDate) return;
    const asOf = period.asOfDate;
    const comparative = comparativeAsOf(asOf, compareMode, {
      years: period.years,
      previousFiscalMonthEnd:
        period.mode === 'fiscal-month' ? (period.previousPeriod?.toDate ?? null) : null,
    });
    setFiltersOpen(false);
    setApplied({
      asOfDate: asOf,
      periodLabel: period.label,
      yearStart: fiscalYearStart(asOf, period.years),
      compare: compareMode,
      comparativeAsOf: comparative,
      comparativeYearStart: comparative ? fiscalYearStart(comparative, period.years) : null,
    });
  };

  const data = report.data;
  const comparativeData = comparativeReport.data;
  const compare = hasComparative;

  const assets = data ? mergeSection(data, comparativeData, 'ASSET', false) : [];
  const liabilities = data ? mergeSection(data, comparativeData, 'LIABILITY', false) : [];
  const equity = data ? mergeSection(data, comparativeData, 'EQUITY', false) : [];

  const profitFigures = {
    current: toCents(profit.data?.netProfitOrLoss ?? '0'),
    previous: toCents(comparativeProfit.data?.netProfitOrLoss ?? '0'),
  };
  const equityExtraRows: ExtraRow[] =
    profitFigures.current !== 0 || profitFigures.previous !== 0
      ? [{ label: PROFIT_LABEL, ...profitFigures }]
      : [];

  const totals = {
    assets: {
      current: toCents(data?.totalAssets ?? '0'),
      previous: toCents(comparativeData?.totalAssets ?? '0'),
    },
    liabilities: {
      current: toCents(data?.totalLiabilities ?? '0'),
      previous: toCents(comparativeData?.totalLiabilities ?? '0'),
    },
    equity: {
      current: toCents(data?.totalEquity ?? '0') + profitFigures.current,
      previous: toCents(comparativeData?.totalEquity ?? '0') + profitFigures.previous,
    },
  };
  const liabilitiesAndEquity = {
    current: totals.liabilities.current + totals.equity.current,
    previous: totals.liabilities.previous + totals.equity.previous,
  };
  // Assets less liabilities and equity: zero when the books balance.
  const imbalance = {
    current: totals.assets.current - liabilitiesAndEquity.current,
    previous: totals.assets.previous - liabilitiesAndEquity.previous,
  };
  const balanced = imbalance.current === 0 && (!compare || imbalance.previous === 0);

  const isFetching =
    report.isFetching ||
    profit.isFetching ||
    comparativeReport.isFetching ||
    comparativeProfit.isFetching;
  const loadError =
    report.error ?? profit.error ?? comparativeReport.error ?? comparativeProfit.error;
  const isLoading =
    report.isLoading ||
    profit.isLoading ||
    (compare && (comparativeReport.isLoading || comparativeProfit.isLoading)) ||
    !data;

  const collapsed = applied !== null && !filtersOpen;
  const reportReady = applied !== null && !!data && !isLoading && !isFetching && !loadError;
  const columnLabels = {
    current: applied ? formatDate(applied.asOfDate) : 'Current',
    previous: applied?.comparativeAsOf ? formatDate(applied.comparativeAsOf) : 'Comparative',
  };
  const periodText = applied
    ? `${applied.periodLabel ? `${applied.periodLabel} · ` : ''}As at ${formatDate(applied.asOfDate)}`
    : '';
  const comparativeText = applied?.comparativeAsOf
    ? `Compared with ${formatDate(applied.comparativeAsOf)} (${BALANCE_COMPARE_LABELS[applied.compare]})`
    : null;

  const buildExport = (): StatementExport | null => {
    if (!applied || !data) return null;
    return {
      title: 'Balance Sheet',
      companyName: tenant?.name ?? '',
      currency,
      metaLines: [
        periodText,
        ...(comparativeText ? [comparativeText] : []),
        `${currency ? `Amounts in ${currency} · ` : ''}Posted entries only`,
      ],
      columnLabels,
      sections: [
        {
          title: 'Assets',
          classifications: assets,
          totalLabel: 'Total Assets',
          emphasizeTotal: true,
          totals: totals.assets,
        },
        {
          title: 'Liabilities',
          classifications: liabilities,
          totalLabel: 'Total Liabilities',
          totals: totals.liabilities,
        },
        {
          title: 'Equity',
          classifications: equity,
          totalLabel: 'Total Equity',
          totals: totals.equity,
          extraRows: equityExtraRows,
        },
      ],
      closing: [
        {
          label: 'Total Liabilities and Equity',
          figures: liabilitiesAndEquity,
          tone: 'neutral',
        },
        {
          label: 'Balance check (assets − liabilities − equity)',
          figures: imbalance,
          tone: balanced ? 'positive' : 'negative',
        },
      ],
      compare,
      filename: `balance-sheet_${applied.asOfDate}`,
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

  const noActivity =
    assets.length === 0 &&
    liabilities.length === 0 &&
    equity.length === 0 &&
    equityExtraRows.length === 0;

  // Without a comparison the statement sits side by side (assets | liabilities and equity), so
  // each half uses the compact grid and the totals are pinned to the bottom to line up.
  const sideBySide = !compare;
  const sectionProps = { compare, currency, columnLabels, compact: sideBySide };
  const assetsSection = (
    <SectionBlock
      title="Assets"
      classifications={assets}
      totalLabel="Total Assets"
      emphasizeTotal
      fill={sideBySide}
      totals={totals.assets}
      emptyText="No assets as at this date."
      {...sectionProps}
    />
  );
  const liabilitiesSection = (
    <SectionBlock
      title="Liabilities"
      classifications={liabilities}
      totalLabel="Total Liabilities"
      totals={totals.liabilities}
      emptyText="No liabilities as at this date."
      {...sectionProps}
    />
  );
  const equitySection = (
    <SectionBlock
      title="Equity"
      classifications={equity}
      totalLabel="Total Equity"
      totals={totals.equity}
      extraRows={equityExtraRows}
      emptyText="No equity as at this date."
      {...sectionProps}
    />
  );
  const closingRow = (
    <ClosingRow
      label="Total Liabilities and Equity"
      current={liabilitiesAndEquity.current}
      previous={liabilitiesAndEquity.previous}
      compare={compare}
      compact={sideBySide}
      alignBottom={sideBySide}
      tone="neutral"
    />
  );

  return (
    <section className="flex flex-col gap-6">
      <ReportToolbar
        fields={
          <>
            <ReportPeriodFields period={period} />
            <BaseCurrencyField currency={currency} />
            <div className="w-56">
              <SearchSelect
                label="Compare with"
                placeholder="Compare with"
                options={compareOptions}
                value={compareMode}
                onChange={(value) => setCompareMode(value as BalanceCompareMode)}
                clearable={false}
              />
            </div>
          </>
        }
        summary={
          applied && (
            <>
              <SummaryChip label="As at" value={periodText.replace('As at ', '')} />
              {currency && <SummaryChip label="Currency" value={currency} />}
              <SummaryChip
                label="Compare"
                value={
                  applied.comparativeAsOf
                    ? `${BALANCE_COMPARE_LABELS[applied.compare]} · ${formatDate(applied.comparativeAsOf)}`
                    : 'None'
                }
              />
            </>
          )
        }
        collapsed={collapsed}
        hasReport={applied !== null}
        onToggle={() => setFiltersOpen((open) => !open)}
        onGenerate={generate}
        generateDisabled={
          !period.asOfDate ||
          period.yearsLoading ||
          (compareMode === 'previous-month-end' &&
            period.mode === 'fiscal-month' &&
            period.previousPending)
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
          Choose an as-at date and generate the report.
        </p>
      ) : report.isError ||
        profit.isError ||
        comparativeReport.isError ||
        comparativeProfit.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Unable to load the balance sheet: {extractError(loadError)}
        </div>
      ) : isLoading || !data ? (
        <p className="py-16 text-center text-sm text-gray-400">Generating report…</p>
      ) : (
        <div className={cardClass('overflow-hidden')}>
          <header className="px-6 py-6 text-center border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Balance Sheet</h2>
            <p className="mt-1 text-sm text-gray-600">{periodText}</p>
            {comparativeText && <p className="mt-1 text-sm text-gray-600">{comparativeText}</p>}
            <p className="mt-1 text-xs text-gray-400">
              {currency ? `Amounts in ${currency} · ` : ''}Posted entries only
            </p>
          </header>

          {noActivity ? (
            <p className="py-16 text-center text-sm text-gray-400">
              No posted accounting activity matches this report.
            </p>
          ) : (
            <div className="overflow-x-auto p-4">
              <div className={cn('flex flex-col', compare && 'min-w-[820px]')}>
                {compare ? (
                  <>
                    {assetsSection}
                    <div className="h-6" />
                    {liabilitiesSection}
                    <div className="h-6" />
                    {equitySection}
                    {closingRow}
                  </>
                ) : (
                  <div className="grid gap-6 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-gray-200">
                    <div className="flex flex-col">{assetsSection}</div>
                    <div className="flex flex-col">
                      {liabilitiesSection}
                      <div className="h-6" />
                      {equitySection}
                      {closingRow}
                    </div>
                  </div>
                )}

                {!balanced && (
                  <div
                    role="alert"
                    className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    <span className="font-semibold">Out of balance</span>
                    {imbalance.current !== 0 && (
                      <>
                        {' '}
                        as at {formatDate(applied.asOfDate)} by{' '}
                        {formatCents(Math.abs(imbalance.current))} (assets{' '}
                        {imbalance.current > 0 ? 'exceed' : 'are below'} liabilities and equity)
                      </>
                    )}
                    {compare && imbalance.previous !== 0 && applied.comparativeAsOf && (
                      <>
                        {imbalance.current !== 0 ? '; ' : ' '}as at{' '}
                        {formatDate(applied.comparativeAsOf)} by{' '}
                        {formatCents(Math.abs(imbalance.previous))}
                      </>
                    )}
                    .
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
