'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/atoms/Input';
import { AgingBlocks, agingRowKey } from '@/components/molecules/accounting/AgingBlocks';
import { ReportToolbar } from '@/components/molecules/accounting/ReportToolbar';
import {
  ReportPeriodFields,
  useReportPeriod,
} from '@/components/molecules/accounting/ReportPeriodFields';
import { SummaryChip } from '@/components/molecules/accounting/StatementBlocks';
import { useAgingReport, useTenant } from '@/hooks';
import { buildAgingBlocks } from '@/lib/accounting/aging';
import { exportAgingCsv, exportAgingPdf, type AgingExport } from '@/lib/accounting/agingExport';
import { formatDate } from '@/lib/accounting/profitAndLoss';
import { extractError } from '@/lib/extractError';
import { cardClass } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

type Side = 'receivables' | 'payables';

const COPY: Record<
  Side,
  { title: string; partyLabel: string; documents: string; filePrefix: string }
> = {
  receivables: {
    title: 'Aged Receivables',
    partyLabel: 'Customer',
    documents: 'invoices',
    filePrefix: 'aged-receivables',
  },
  payables: {
    title: 'Aged Payables',
    partyLabel: 'Vendor',
    documents: 'bills',
    filePrefix: 'aged-payables',
  },
};

type AppliedFilters = { asOfDate: string; periodLabel: string | null };

export function AgingReportView({ side }: { side: Side }) {
  const copy = COPY[side];
  const period = useReportPeriod({ asAt: true });
  const [pdfBusy, setPdfBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const tenantId = useAuthStore((state) => state.user?.tenantId ?? '');
  const { data: tenant } = useTenant(tenantId);
  // The party search narrows the report already on screen (and what is downloaded).
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Filters are only applied on Generate, so editing a field never refetches on its own.
  const [applied, setApplied] = useState<AppliedFilters | null>(null);

  const report = useAgingReport(side, applied?.asOfDate ?? '', applied !== null);
  const data = report.data;
  const blocks = useMemo(() => (data ? buildAgingBlocks(data, search) : []), [data, search]);

  const generate = () => {
    if (!period.asOfDate) return;
    setFiltersOpen(false);
    setExpanded(new Set());
    setApplied({ asOfDate: period.asOfDate, periodLabel: period.label });
  };

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const allKeys = blocks.flatMap((block) =>
    block.parties.map((row) => agingRowKey(block.currency, row.id)),
  );
  const allExpanded = allKeys.length > 0 && allKeys.every((key) => expanded.has(key));

  const collapsed = applied !== null && !filtersOpen;
  const reportReady = applied !== null && !!data && !report.isFetching && !report.isError;
  const asAtText = applied
    ? `${applied.periodLabel ? `${applied.periodLabel} · ` : ''}As at ${formatDate(applied.asOfDate)}`
    : '';
  const scopeText = `Aged by due date · Amounts in each document's own currency · Posted ${copy.documents} only`;
  const searchText = search.trim() ? `${copy.partyLabel} matching "${search.trim()}"` : null;

  const buildExport = (): AgingExport | null => {
    if (!applied || !data) return null;
    return {
      title: copy.title,
      companyName: tenant?.name ?? '',
      metaLines: [asAtText, scopeText, ...(searchText ? [searchText] : [])],
      partyLabel: copy.partyLabel,
      blocks,
      filename: `${copy.filePrefix}_${applied.asOfDate}`,
    };
  };

  const downloadCsv = () => {
    const payload = buildExport();
    if (payload) exportAgingCsv(payload);
  };

  const downloadPdf = async () => {
    const payload = buildExport();
    if (!payload) return;
    setPdfBusy(true);
    try {
      await exportAgingPdf(payload);
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
              <Input
                label={copy.partyLabel}
                placeholder={`Search ${copy.partyLabel.toLowerCase()} name or code`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </>
        }
        summary={
          applied && (
            <>
              <SummaryChip label="As at" value={asAtText.replace('As at ', '')} />
              <SummaryChip label="Aged by" value="Due date" />
              {search.trim() && (
                <SummaryChip label={copy.partyLabel} value={`“${search.trim()}”`} />
              )}
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
          Unable to load {copy.title.toLowerCase()}: {extractError(report.error)}
        </div>
      ) : report.isLoading || !data ? (
        <p className="py-16 text-center text-sm text-gray-400">Generating report…</p>
      ) : (
        <div className={cardClass('overflow-hidden')}>
          <header className="px-6 py-6 text-center border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{copy.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{asAtText}</p>
            <p className="mt-1 text-xs text-gray-400">{scopeText}</p>
            {searchText && <p className="mt-1 text-xs text-gray-400">{searchText}</p>}
          </header>

          {blocks.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">
              {search.trim()
                ? `No ${copy.partyLabel.toLowerCase()} matches your search.`
                : 'No open items match this report.'}
            </p>
          ) : (
            <>
              <div className="flex justify-end px-6 pt-4">
                <button
                  type="button"
                  onClick={() => setExpanded(allExpanded ? new Set() : new Set(allKeys))}
                  className="rounded-md px-2 py-1 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  {allExpanded ? 'Collapse all' : 'Expand all'}
                </button>
              </div>
              <div className="overflow-x-auto p-4">
                <AgingBlocks
                  blocks={blocks}
                  partyLabel={copy.partyLabel}
                  expanded={expanded}
                  onToggle={toggle}
                />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
