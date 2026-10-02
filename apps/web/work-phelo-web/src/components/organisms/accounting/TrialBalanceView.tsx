'use client';

import { useMemo, useState } from 'react';
import {
  BaseCurrencyField,
  useBaseCurrency,
} from '@/components/molecules/accounting/BaseCurrencyField';
import { ReportToolbar } from '@/components/molecules/accounting/ReportToolbar';
import {
  ReportPeriodFields,
  useReportPeriod,
} from '@/components/molecules/accounting/ReportPeriodFields';
import { SummaryChip } from '@/components/molecules/accounting/StatementBlocks';
import {
  TrialCategoryBlock,
  TrialTableHead,
  TrialTotalRow,
} from '@/components/molecules/accounting/TrialBalanceBlocks';
import { useTenant } from '@/hooks';
import { useTrialBalanceReport } from '@/hooks/accounting/useFinancialReports';
import { formatCents, formatDate, toCents } from '@/lib/accounting/profitAndLoss';
import { buildTrialCategories } from '@/lib/accounting/trialBalance';
import {
  exportTrialBalanceCsv,
  exportTrialBalancePdf,
  type TrialBalanceExport,
} from '@/lib/accounting/trialBalanceExport';
import { extractError } from '@/lib/extractError';
import { cardClass } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

type AppliedFilters = {
  asOfDate: string;
  periodLabel: string | null;
  includeZero: boolean;
};

export function TrialBalanceView() {
  const period = useReportPeriod({ asAt: true });
  const [pdfBusy, setPdfBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const currency = useBaseCurrency();
  const tenantId = useAuthStore((state) => state.user?.tenantId ?? '');
  const { data: tenant } = useTenant(tenantId);
  const [includeZero, setIncludeZero] = useState(false);
  // Filters are only applied on Generate, so editing a field never refetches on its own.
  const [applied, setApplied] = useState<AppliedFilters | null>(null);

  const report = useTrialBalanceReport(
    { asOfDate: applied?.asOfDate, includeZeroBalances: applied?.includeZero },
    applied !== null,
  );

  const generate = () => {
    if (!period.asOfDate) return;
    setFiltersOpen(false);
    setApplied({ asOfDate: period.asOfDate, periodLabel: period.label, includeZero });
  };

  const data = report.data;
  const categories = useMemo(() => (data ? buildTrialCategories(data) : []), [data]);
  const totals = {
    debit: toCents(data?.totalDebit ?? '0'),
    credit: toCents(data?.totalCredit ?? '0'),
  };
  // Zero when the ledger balances; the warning below only appears otherwise.
  const imbalance = totals.debit - totals.credit;

  const collapsed = applied !== null && !filtersOpen;
  const reportReady = applied !== null && !!data && !report.isFetching && !report.isError;
  const asAtText = applied
    ? `${applied.periodLabel ? `${applied.periodLabel} · ` : ''}As at ${formatDate(applied.asOfDate)}`
    : '';
  const scopeText = `${currency ? `Amounts in ${currency} · ` : ''}Posted entries only${
    applied?.includeZero ? ' · Zero balances included' : ''
  }`;

  const buildExport = (): TrialBalanceExport | null => {
    if (!applied || !data) return null;
    return {
      companyName: tenant?.name ?? '',
      currency,
      metaLines: [asAtText, scopeText],
      categories,
      totals,
      imbalance,
      filename: `trial-balance_${applied.asOfDate}`,
    };
  };

  const downloadCsv = () => {
    const payload = buildExport();
    if (payload) exportTrialBalanceCsv(payload);
  };

  const downloadPdf = async () => {
    const payload = buildExport();
    if (!payload) return;
    setPdfBusy(true);
    try {
      await exportTrialBalancePdf(payload);
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
            <BaseCurrencyField currency={currency} />
            <label className="flex items-center gap-2 pb-2.5 text-sm text-gray-700 select-none">
              <input
                type="checkbox"
                checked={includeZero}
                onChange={(event) => setIncludeZero(event.target.checked)}
              />
              Include zero balances
            </label>
          </>
        }
        summary={
          applied && (
            <>
              <SummaryChip label="As at" value={asAtText.replace('As at ', '')} />
              {currency && <SummaryChip label="Currency" value={currency} />}
              {applied.includeZero && <SummaryChip label="Zero balances" value="Included" />}
            </>
          )
        }
        collapsed={collapsed}
        hasReport={applied !== null}
        onToggle={() => setFiltersOpen((open) => !open)}
        onGenerate={generate}
        generateDisabled={!period.asOfDate}
        generating={report.isFetching}
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
      ) : report.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Unable to load the trial balance: {extractError(report.error)}
        </div>
      ) : report.isLoading || !data ? (
        <p className="py-16 text-center text-sm text-gray-400">Generating report…</p>
      ) : (
        <div className={cardClass('overflow-hidden')}>
          <header className="px-6 py-6 text-center border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Trial Balance</h2>
            <p className="mt-1 text-sm text-gray-600">{asAtText}</p>
            <p className="mt-1 text-xs text-gray-400">{scopeText}</p>
          </header>

          {categories.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">
              No posted accounting activity matches this report.
            </p>
          ) : (
            <div className="overflow-x-auto p-4">
              <div className="flex flex-col min-w-[560px]">
                <TrialTableHead currency={currency} />
                {categories.map((category) => (
                  <TrialCategoryBlock key={category.category} category={category} />
                ))}
                <TrialTotalRow debit={totals.debit} credit={totals.credit} />

                {imbalance !== 0 && (
                  <div
                    role="alert"
                    className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    <span className="font-semibold">Out of balance</span> by{' '}
                    {formatCents(Math.abs(imbalance))} (total {imbalance > 0 ? 'debits' : 'credits'}{' '}
                    exceed total {imbalance > 0 ? 'credits' : 'debits'}).
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
