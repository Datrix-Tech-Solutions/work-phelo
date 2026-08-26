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
import {
  useCedantOptions,
  useRiskTypeOptions,
  useCurrencyOptions,
  usePremiumsReport,
} from '@/hooks';
import { PremiumReportRow, PremiumsReportParams } from '@/hooks/reinsurance/usePremiumsReport';
import { CedantPaymentStatus } from '@/lib/reinsurance/placementStatus';
import { exportToCsv } from '@/lib/exportCsv';

const PAGE_SIZE = 10;

const PAYMENT_STATUS_OPTIONS: { value: CedantPaymentStatus; label: string }[] = [
  { value: 'Outstanding', label: 'Outstanding' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Part Payment', label: 'Part Payment' },
  { value: 'Paid', label: 'Paid' },
];

const STATUS_VARIANT_MAP: Record<CedantPaymentStatus, 'success' | 'warning' | 'neutral'> = {
  Outstanding: 'neutral',
  Pending: 'warning',
  'Part Payment': 'warning',
  Paid: 'success',
};

function fmtAmount(value: number, currency: string | null): string {
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function PremiumsReportTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [page, setPage] = useState(1);

  // Staged filter values — only applied to the report once "Run Filter" is clicked.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [riskTypeId, setRiskTypeId] = useState('');
  const [currency, setCurrency] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [cedantIds, setCedantIds] = useState<string[]>([]);
  const [reportParams, setReportParams] = useState<PremiumsReportParams | null>(null);

  const { options: cedantOptions } = useCedantOptions();
  const { data: riskTypeOptions = [] } = useRiskTypeOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  const { rows, isLoading } = usePremiumsReport(reportParams ?? {}, {
    enabled: reportParams !== null,
  });

  const handleRunFilter = () => {
    setReportParams({
      startDate,
      endDate,
      riskTypeId: riskTypeId || undefined,
      currency: currency || undefined,
      paymentStatus: (paymentStatus || undefined) as CedantPaymentStatus | undefined,
      cedantIds: cedantIds.length ? cedantIds : undefined,
    });
    setPage(1);
  };

  const columns: Column<PremiumReportRow>[] = useMemo(
    () => [
      {
        key: 'policyNumber',
        label: 'Policy Number',
        width: '150px',
        render: (row) => <EndorsedReferencePill id={row.id} reference={row.policyNumber} />,
      },
      {
        key: 'cedantName',
        label: 'Insured / Cedant',
        width: 'minmax(140px, 1fr)',
        render: (row) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-gray-900 leading-tight">{row.title}</span>
            <span className="text-xs text-gray-400">{row.cedantName}</span>
          </div>
        ),
      },
      {
        key: 'due',
        label: 'Due',
        width: '140px',
        className: 'text-right',
        render: (row) => fmtAmount(row.due, row.currency),
      },
      {
        key: 'paid',
        label: 'Paid',
        width: '140px',
        className: 'text-right',
        render: (row) => fmtAmount(row.paid, row.currency),
      },
      {
        key: 'outstanding',
        label: 'Outstanding',
        width: '140px',
        className: 'text-right',
        render: (row) => fmtAmount(row.outstanding, row.currency),
      },
      {
        key: 'pending',
        label: 'Pending',
        width: '140px',
        className: 'text-right',
        render: (row) =>
          row.pending > 0.0001 ? (
            <span className="text-amber-600 font-medium">
              {fmtAmount(row.pending, row.currency)}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          ),
      },
      {
        key: 'inceptionDate',
        label: 'Inception',
        width: '130px',
        render: (row) => fmtDate(row.inceptionDate),
      },
      {
        key: 'paymentStatus',
        label: 'Status',
        width: '110px',
        render: (row) => (
          <Badge label={row.paymentStatus} variant={STATUS_VARIANT_MAP[row.paymentStatus]} />
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
      'Insured',
      'Cedant',
      'Currency',
      'Due',
      'Paid',
      'Outstanding',
      'Pending',
      'Inception',
      'Status',
    ];
    const data = rows.map((row) => [
      row.policyNumber,
      row.title,
      row.cedantName,
      row.currency ?? '',
      row.due,
      row.paid,
      row.outstanding,
      row.pending,
      fmtDate(row.inceptionDate),
      row.paymentStatus,
    ]);
    exportToCsv(`premiums-report-${new Date().toISOString().slice(0, 10)}.csv`, headers, data);
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="flex-1 min-h-0">
        <DataTable
          columns={columns}
          data={paged}
          isLoading={reportParams !== null && isLoading}
          onRowClick={(row) =>
            router.push(`/${tenantSlug}/operations/reinsurance/payments/${row.id}`)
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
              <div className="w-36">
                <SearchSelect
                  size="sm"
                  showAllOption
                  placeholder="Risk type"
                  options={riskTypeOptions}
                  value={riskTypeId}
                  onChange={setRiskTypeId}
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
                  options={PAYMENT_STATUS_OPTIONS}
                  value={paymentStatus}
                  onChange={setPaymentStatus}
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
              ? 'No premium activity for the selected filters'
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
