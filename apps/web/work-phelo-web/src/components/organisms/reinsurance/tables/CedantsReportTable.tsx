'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { CedantReportRow, CedantsReportSummary } from '@/hooks/reinsurance/useCedantsReport';

const PAGE_SIZE = 10;

function fmtAmount(value: number, symbol: string): string {
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol} ${formatted}` : formatted;
}

interface CedantsReportTableProps {
  rows: CedantReportRow[];
  currencySymbol: CedantsReportSummary['currencySymbol'];
  isLoading: boolean;
}

export function CedantsReportTable({ rows, currencySymbol, isLoading }: CedantsReportTableProps) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [page, setPage] = useState(1);

  const columns: Column<CedantReportRow & { id: string }>[] = useMemo(
    () => [
      { key: 'name', label: 'Cedant', width: 'minmax(150px, 1fr)' },
      {
        key: 'placementCount',
        label: 'Offers',
        width: '100px',
        render: (row) => row.placementCount.toLocaleString(),
      },
      {
        key: 'totalPremium',
        label: 'Total Premium',
        width: '150px',
        render: (row) => fmtAmount(row.totalPremium, currencySymbol),
      },
      {
        key: 'outstanding',
        label: 'Outstanding',
        width: '150px',
        render: (row) => fmtAmount(row.outstanding, currencySymbol),
      },
      {
        key: 'pending',
        label: 'Pending',
        width: '150px',
        render: (row) =>
          row.pending > 0.0001 ? (
            <span className="text-amber-600 font-medium">
              {fmtAmount(row.pending, currencySymbol)}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          ),
      },
    ],
    [currencySymbol],
  );

  const data = useMemo(() => rows.map((r) => ({ ...r, id: r.cedantId })), [rows]);
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const paged = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DataTable
      columns={columns}
      data={paged}
      isLoading={isLoading}
      onRowClick={(row) =>
        router.push(`/${tenantSlug}/operations/reinsurance/cedants/${row.cedantId}`)
      }
      emptyMessage="No cedant activity for the selected filters"
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
      noInternalScroll
    />
  );
}
