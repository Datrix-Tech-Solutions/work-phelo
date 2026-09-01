'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { useCedantOptions, useCurrencyOptions, useClaimsReport } from '@/hooks';
import {
  ClaimReportRow,
  ClaimsReportBucket,
  ClaimsReportParams,
} from '@/hooks/reinsurance/useClaimsReport';
import { exportToCsv } from '@/lib/exportCsv';

const PAGE_SIZE = 10;

const BUCKET_OPTIONS: { value: ClaimsReportBucket; label: string }[] = [
  { value: 'notification', label: 'Notification' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

const BUCKET_LABEL: Record<ClaimsReportBucket, string> = {
  notification: 'Notification',
  open: 'Open',
  closed: 'Closed',
};

const BUCKET_VARIANT_MAP: Record<ClaimsReportBucket, 'success' | 'warning' | 'neutral'> = {
  notification: 'neutral',
  open: 'warning',
  closed: 'success',
};

function fmtAmount(value: number | null, currency: string): string {
  if (value == null) return '—';
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatted}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const MS_PER_DAY = 86_400_000;

function fmtAging(row: ClaimReportRow): string {
  if (!row.finalizedAt) return '—';
  const from = new Date(row.finalizedAt).getTime();
  const to = row.recoveredAt ? new Date(row.recoveredAt).getTime() : Date.now();
  const days = Math.max(0, Math.floor((to - from) / MS_PER_DAY));
  if (days <= 30) return '0-30';
  if (days <= 60) return '30-60';
  return '60+';
}

export function ClaimsReportTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [page, setPage] = useState(1);

  // Staged filter values — only applied to the report once "Run Filter" is clicked.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currency, setCurrency] = useState('');
  const [bucket, setBucket] = useState('');
  const [cedantIds, setCedantIds] = useState<string[]>([]);
  const [reportParams, setReportParams] = useState<ClaimsReportParams | null>(null);

  const { options: cedantOptions } = useCedantOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  const { rows, isLoading } = useClaimsReport(reportParams ?? {}, {
    enabled: reportParams !== null,
  });

  const handleRunFilter = () => {
    setReportParams({
      startDate,
      endDate,
      currency: currency || undefined,
      bucket: (bucket || undefined) as ClaimsReportBucket | undefined,
      cedantIds: cedantIds.length ? cedantIds : undefined,
    });
    setPage(1);
  };

  const columns: Column<ClaimReportRow>[] = useMemo(
    () => [
      {
        key: 'policyNumber',
        label: 'Policy Number',
        width: '150px',
        render: (row) => (
          <EndorsedReferencePill id={row.placementId} reference={row.policyNumber} />
        ),
      },
      {
        key: 'claimNumber',
        label: 'Claim Number',
        width: '130px',
        render: (row) => <span className="font-medium text-gray-900">{row.claimNumber}</span>,
      },
      {
        key: 'cedantName',
        label: 'Cedant',
        width: 'minmax(120px, 1fr)',
        render: (row) => <span className="text-gray-700">{row.cedantName}</span>,
      },
      {
        key: 'occurrenceDate',
        label: 'Occurrence',
        width: '90px',
        render: (row) => fmtDate(row.occurrenceDate),
      },
      {
        key: 'estimatedLossAmount',
        label: 'Estimated Claim',
        width: '150px',
        className: 'text-right',
        render: (row) => fmtAmount(row.estimatedLossAmount, row.currency),
      },
      {
        key: 'finalLossAmount',
        label: 'Actual Claim',
        width: '150px',
        className: 'text-right',
        render: (row) => fmtAmount(row.finalLossAmount, row.currency),
      },
      {
        key: 'recoveredAmount',
        label: 'Recovered',
        width: '150px',
        className: 'text-right',
        render: (row) => fmtAmount(row.recoveredAmount, row.currency),
      },
      {
        key: 'aging',
        label: 'Aging',
        width: '60px',
        render: (row) => <span className="text-gray-700">{fmtAging(row)}</span>,
      },
      {
        key: 'bucket',
        label: 'Status',
        width: '100px',
        render: (row) => (
          <Badge label={BUCKET_LABEL[row.bucket]} variant={BUCKET_VARIANT_MAP[row.bucket]} />
        ),
      },
    ],
    [],
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = () => {
    const headers = [
      'Policy Number',
      'Claim Number',
      'Cedant',
      'Currency',
      'Occurrence',
      'Estimated Claim',
      'Actual Claim',
      'Recovered',
      'Aging',
      'Status',
    ];
    const data = rows.map((row) => [
      row.policyNumber,
      row.claimNumber,
      row.cedantName,
      row.currency,
      fmtDate(row.occurrenceDate),
      row.estimatedLossAmount,
      row.finalLossAmount ?? '',
      row.recoveredAmount ?? '',
      fmtAging(row),
      BUCKET_LABEL[row.bucket],
    ]);
    exportToCsv(`claims-report-${new Date().toISOString().slice(0, 10)}.csv`, headers, data);
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="flex-1 min-h-0">
        <DataTable
          columns={columns}
          data={paged}
          isLoading={reportParams !== null && isLoading}
          onRowClick={(row) =>
            router.push(
              `/${tenantSlug}/operations/reinsurance/claims/${row.id}?placementId=${row.placementId}&tab=${row.bucket}`,
            )
          }
          onExport={reportParams && rows.length > 0 ? handleExport : undefined}
          extraFilters={
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-50">
                <DatePicker
                  size="sm"
                  placeholder="Period start"
                  value={startDate}
                  onChange={setStartDate}
                />
              </div>
              <div className="w-50">
                <DatePicker
                  size="sm"
                  placeholder="Period end"
                  value={endDate}
                  minDate={startDate || undefined}
                  onChange={setEndDate}
                />
              </div>
              <div className="w-32">
                <SearchSelect
                  size="sm"
                  showAllOption
                  placeholder="Currency"
                  options={currencyOptions}
                  value={currency}
                  onChange={setCurrency}
                />
              </div>
              <div className="w-36">
                <SearchSelect
                  size="sm"
                  showAllOption
                  placeholder="Status"
                  options={BUCKET_OPTIONS}
                  value={bucket}
                  onChange={setBucket}
                />
              </div>
              <div className="w-44">
                <MultiSelect
                  size="sm"
                  variant="inline"
                  placeholder="Cedants"
                  options={cedantOptions}
                  value={cedantIds}
                  onChange={setCedantIds}
                />
              </div>
            </div>
          }
          actionButton={{
            label: 'Run Filter',
            onClick: handleRunFilter,
            disabled: !startDate || !endDate,
          }}
          emptyMessage={
            reportParams
              ? 'No claims activity for the selected filters'
              : 'Select a period and click Run Filter to generate the report'
          }
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          noInternalScroll
        />
      </div>
    </div>
  );
}
