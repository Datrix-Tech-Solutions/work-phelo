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
import { ReportCurrencySummaryCards } from '@/components/molecules/reinsurance/reports/ReportCurrencySummaryCards';
import {
  useCedantOptions,
  useRiskTypeOptions,
  useCurrencyOptions,
  useFacultativeReport,
} from '@/hooks';
import {
  FacultativeReportRow,
  FacultativeReportParams,
} from '@/hooks/reinsurance/useFacultativeReport';
import { FACULTATIVE_STATUSES, FacultativeStatus } from '@/types/reinsurance';
import { facultativeStatusLabel } from '@/lib/reinsurance/placementStatus';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

const PAGE_SIZE = 10;

const STATUS_OPTIONS = FACULTATIVE_STATUSES.map((s) => ({
  value: s,
  label: facultativeStatusLabel(s),
}));

const STATUS_VARIANT_MAP: Record<FacultativeStatus, 'success' | 'warning' | 'neutral' | 'danger'> =
  {
    DRAFT: 'neutral',
    MARKETING: 'warning',
    PARTIALLY_PLACED: 'success',
    PLACED: 'success',
    CLOSING: 'warning',
    CLOSED: 'success',
    DECLINED: 'danger',
    CANCELLED: 'danger',
  };

function fmtAmount(value: number | null, currency: string | null): string {
  if (value == null) return '—';
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

export function FacultativeReportTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [page, setPage] = useState(1);

  // Staged filter values — only applied to the report once "Run Filter" is clicked.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [riskTypeId, setRiskTypeId] = useState('');
  const [currency, setCurrency] = useState('');
  const [status, setStatus] = useState('');
  const [cedantIds, setCedantIds] = useState<string[]>([]);
  const [reportParams, setReportParams] = useState<FacultativeReportParams | null>(null);

  const { options: cedantOptions } = useCedantOptions();
  const { data: riskTypeOptions = [] } = useRiskTypeOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  const { rows, currencyTotals, isLoading } = useFacultativeReport(reportParams ?? {}, {
    enabled: reportParams !== null,
  });

  const handleRunFilter = () => {
    setReportParams({
      startDate,
      endDate,
      riskTypeId: riskTypeId || undefined,
      currency: currency || undefined,
      status: (status || undefined) as FacultativeStatus | undefined,
      cedantIds: cedantIds.length ? cedantIds : undefined,
    });
    setPage(1);
  };

  const columns: Column<FacultativeReportRow>[] = useMemo(
    () => [
      {
        key: 'reference',
        label: 'Policy Number',
        width: '150px',
        render: (row) => (
          <EndorsedReferencePill id={row.id} reference={displayPolicyNumber(row.policyNumber)} />
        ),
      },
      {
        key: 'cedantName',
        label: 'Cedant / Risk Type',
        width: 'minmax(120px, 0.8fr)',
        render: (row) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-gray-900 leading-tight">{row.cedantName}</span>
            <span className="text-xs text-gray-400">{row.classOfBusiness ?? '—'}</span>
          </div>
        ),
      },
      {
        key: 'sumInsured',
        label: 'Sum Insured',
        width: '150px',
        render: (row) => fmtAmount(row.sumInsured, row.currency),
      },
      {
        key: 'premium',
        label: 'Premium',
        width: '150px',
        render: (row) => fmtAmount(row.premium, row.currency),
      },
      {
        key: 'totalAcceptedPercent',
        label: 'Accepted',
        width: '100px',
        render: (row) => `${row.totalAcceptedPercent}%`,
      },
      {
        key: 'inceptionDate',
        label: 'Inception',
        width: '150px',
        render: (row) => fmtDate(row.inceptionDate),
      },
      {
        key: 'status',
        label: 'Status',
        width: '100px',
        render: (row) => (
          <Badge
            label={facultativeStatusLabel(row.status)}
            variant={STATUS_VARIANT_MAP[row.status]}
          />
        ),
      },
    ],
    [],
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {reportParams && <ReportCurrencySummaryCards totals={currencyTotals} isLoading={isLoading} />}

      <div className="flex-1 min-h-0">
        <DataTable
          columns={columns}
          data={paged}
          isLoading={reportParams !== null && isLoading}
          onRowClick={(row) =>
            router.push(`/${tenantSlug}/operations/reinsurance/facultative/${row.id}`)
          }
          extraFilters={
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-38">
                <DatePicker
                  size="sm"
                  placeholder="Period start"
                  value={startDate}
                  onChange={setStartDate}
                />
              </div>
              <div className="w-38">
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
                  placeholder="Risk type"
                  options={riskTypeOptions}
                  value={riskTypeId}
                  onChange={setRiskTypeId}
                />
              </div>
              <div className="w-32">
                <SearchSelect
                  size="sm"
                  placeholder="Currency"
                  options={currencyOptions}
                  value={currency}
                  onChange={setCurrency}
                />
              </div>
              <div className="w-32">
                <SearchSelect
                  size="sm"
                  placeholder="Status"
                  options={STATUS_OPTIONS}
                  value={status}
                  onChange={setStatus}
                />
              </div>
              <div className="w-44">
                <MultiSelect
                  size="sm"
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
              ? 'No facultative activity for the selected filters'
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
