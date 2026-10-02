'use client';

import { useState } from 'react';
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
  Figures,
  SummaryChip,
  singleGrid,
} from '@/components/molecules/accounting/StatementBlocks';
import { useCashFlowStatementReport } from '@/hooks/accounting/useFinancialReports';
import { formatDate, toCents } from '@/lib/accounting/profitAndLoss';
import { extractError } from '@/lib/extractError';
import { cardClass, cn } from '@/lib/utils';
import type { CashFlowStatementReport } from '@/types/accounting';

type AppliedFilters = {
  fromDate: string;
  toDate: string;
  periodLabel: string | null;
};

type Row = { account: { code: string; name: string }; amount: string };

/** One activity section: a flat list of account rows (no classification/group nesting — a
 *  cash flow statement is grouped by activity type, not by chart-of-accounts hierarchy) with
 *  a subtotal. */
function ActivitySection({
  title,
  rows,
  totalLabel,
  total,
  emptyText,
}: {
  title: string;
  rows: Row[];
  totalLabel: string;
  total: number;
  emptyText: string;
}) {
  return (
    <div className="flex flex-col">
      <div className={cn(singleGrid, 'pb-1')}>
        <span className="col-span-full text-sm font-bold uppercase tracking-wide text-gray-900">
          {title}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-6 py-2 text-sm text-gray-400">{emptyText}</p>
      ) : (
        rows.map((row, index) => (
          <div
            key={`${row.account.code}-${index}`}
            className={cn(singleGrid, 'py-1 hover:bg-gray-50')}
          >
            <span className="text-sm text-gray-700">
              <span className="mr-3 text-gray-400 tabular-nums">{row.account.code}</span>
              {row.account.name}
            </span>
            <Figures current={toCents(row.amount)} previous={0} compare={false} />
          </div>
        ))
      )}
      <div className={cn(singleGrid, 'py-1.5 mt-1 border-t border-gray-200')}>
        <span className="text-sm font-semibold text-gray-800">{totalLabel}</span>
        <Figures
          current={total}
          previous={0}
          compare={false}
          className="font-semibold text-gray-800"
        />
      </div>
    </div>
  );
}

export function CashFlowStatementView() {
  const period = useReportPeriod();
  const currency = useBaseCurrency();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [applied, setApplied] = useState<AppliedFilters | null>(null);

  const report = useCashFlowStatementReport(
    { fromDate: applied?.fromDate, toDate: applied?.toDate },
    applied !== null,
  );

  const generate = () => {
    if (!period.range) return;
    setFiltersOpen(false);
    setApplied({ ...period.range, periodLabel: period.label });
  };

  const data: CashFlowStatementReport | undefined = report.data;
  const collapsed = applied !== null && !filtersOpen;
  const isLoading = report.isLoading || !data;

  return (
    <section className="flex flex-col gap-6">
      <ReportToolbar
        fields={<ReportPeriodFields period={period} />}
        summary={
          applied && (
            <>
              <SummaryChip
                label="Period"
                value={`${applied.periodLabel ? `${applied.periodLabel} · ` : ''}${formatDate(applied.fromDate)} – ${formatDate(applied.toDate)}`}
              />
              {currency && <SummaryChip label="Currency" value={currency} />}
            </>
          )
        }
        collapsed={collapsed}
        hasReport={applied !== null}
        onToggle={() => setFiltersOpen((open) => !open)}
        onGenerate={generate}
        generateDisabled={!period.range}
        generating={report.isFetching}
        // Export isn't built for this report yet (a fast-follow) — it doesn't fit the
        // classification/group-based exporter the other statements share, since cash flow is
        // grouped by activity type instead.
        onDownloadPdf={() => {}}
        onDownloadCsv={() => {}}
        downloadDisabled
        pdfBusy={false}
      />

      <BaseCurrencyField currency={currency} />

      {applied === null ? (
        <p className="py-16 text-center text-sm text-gray-400">
          Choose a period and generate the report.
        </p>
      ) : report.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Unable to load the cash flow statement: {extractError(report.error)}
        </div>
      ) : isLoading ? (
        <p className="py-16 text-center text-sm text-gray-400">Generating report…</p>
      ) : (
        <div className={cardClass('overflow-hidden')}>
          <header className="border-b border-gray-200 px-6 py-6 text-center">
            <h2 className="text-lg font-semibold text-gray-900">Cash Flow Statement</h2>
            <p className="mt-1 text-sm text-gray-600">
              {applied.periodLabel ? `${applied.periodLabel} · ` : ''}For the period{' '}
              {formatDate(applied.fromDate)} to {formatDate(applied.toDate)}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {currency ? `Amounts in ${currency} · ` : ''}Posted entries only · Indirect method
            </p>
          </header>

          <div className="flex flex-col gap-6 p-4">
            <ActivitySection
              title="Operating Activities"
              rows={[
                {
                  account: { code: '', name: 'Net Income' },
                  amount: data.operatingActivities.netIncome,
                },
                ...data.operatingActivities.adjustments,
              ]}
              totalLabel="Net Cash from Operating Activities"
              total={toCents(data.operatingActivities.total)}
              emptyText="No operating adjustments in this period."
            />

            <ActivitySection
              title="Investing Activities"
              rows={data.investingActivities.lines}
              totalLabel="Net Cash from Investing Activities"
              total={toCents(data.investingActivities.total)}
              emptyText="No investing activity in this period."
            />

            <ActivitySection
              title="Financing Activities"
              rows={data.financingActivities.lines}
              totalLabel="Net Cash from Financing Activities"
              total={toCents(data.financingActivities.total)}
              emptyText="No financing activity in this period."
            />

            <ClosingRow
              label="Net Change in Cash"
              current={toCents(data.netChangeInCash)}
              previous={0}
              compare={false}
              tone={toCents(data.netChangeInCash) < 0 ? 'negative' : 'positive'}
            />

            <div className={cn(singleGrid, 'text-sm text-gray-700')}>
              <span>Opening Cash Balance</span>
              <Figures current={toCents(data.openingCash)} previous={0} compare={false} />
            </div>
            <div className={cn(singleGrid, 'text-sm font-semibold text-gray-900')}>
              <span>Closing Cash Balance</span>
              <Figures current={toCents(data.closingCash)} previous={0} compare={false} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
