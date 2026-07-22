'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { FacultativeReportRow } from '@/hooks/reinsurance/useFacultativeReport';
import { FacultativeStatus } from '@/types/reinsurance';
import { facultativeStatusLabel } from '@/lib/reinsurance/placementStatus';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

const PAGE_SIZE = 10;

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

interface FacultativeReportTableProps {
  rows: FacultativeReportRow[];
  isLoading: boolean;
}

export function FacultativeReportTable({ rows, isLoading }: FacultativeReportTableProps) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [page, setPage] = useState(1);

  const columns: Column<FacultativeReportRow>[] = useMemo(
    () => [
      {
        key: 'reference',
        label: 'Policy Number',
        render: (row) => (
          <EndorsedReferencePill id={row.id} reference={displayPolicyNumber(row.policyNumber)} />
        ),
      },
      {
        key: 'cedantName',
        label: 'Cedant / Risk Type',
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
        render: (row) => fmtAmount(row.sumInsured, row.currency),
      },
      {
        key: 'premium',
        label: 'Premium',
        render: (row) => fmtAmount(row.premium, row.currency),
      },
      {
        key: 'totalAcceptedPercent',
        label: 'Offered / Accepted',
        render: (row) => `${row.totalOfferedPercent}% / ${row.totalAcceptedPercent}%`,
      },
      {
        key: 'status',
        label: 'Status',
        render: (row) => (
          <Badge
            label={facultativeStatusLabel(row.status)}
            variant={STATUS_VARIANT_MAP[row.status]}
          />
        ),
      },
      {
        key: 'inceptionDate',
        label: 'Inception',
        render: (row) => fmtDate(row.inceptionDate),
      },
    ],
    [],
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DataTable
      columns={columns}
      data={paged}
      isLoading={isLoading}
      onRowClick={(row) =>
        router.push(`/${tenantSlug}/operations/reinsurance/facultative/${row.id}`)
      }
      emptyMessage="No facultative activity for the selected filters"
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
      noInternalScroll
    />
  );
}
