'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/atoms/Badge';
import { StatCard } from '@/components/atoms/StatCard';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Facultative, toDisplayStatus } from '@/types/reinsurance';

const PAGE_SIZE = 10;

const STATUS_VARIANT_MAP: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  Open: 'warning',
  Closed: 'success',
  Cancelled: 'danger',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null, currency: string | null): string {
  if (val == null) return '—';
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PLACEMENT_COLUMNS: Column<Facultative>[] = [
  {
    key: 'reference',
    label: 'Policy Number',
    width: '1fr',
    render: (row) => <span className="font-medium text-gray-900">{row.reference}</span>,
  },
  {
    key: 'title',
    label: 'Insured',
    width: '1.5fr',
    render: (row) => <span className="text-gray-700">{row.title}</span>,
  },
  {
    key: 'classOfBusiness',
    label: 'Risk Type',
    width: '1.2fr',
    render: (row) => <span className="text-gray-600">{row.classOfBusiness ?? '—'}</span>,
  },
  {
    key: 'facultativeOffer',
    label: 'Fac. Offer (%)',
    width: '110px',
    render: (row) => (
      <span className="text-gray-700">
        {row.facultativeOffer != null ? `${row.facultativeOffer}%` : '—'}
      </span>
    ),
  },
  {
    key: 'premium',
    label: 'Gross Premium',
    width: '1.2fr',
    render: (row) => <span className="text-gray-700">{fmtAmount(row.premium, row.currency)}</span>,
  },
  {
    key: 'commission',
    label: 'Net Premium',
    width: '1.2fr',
    render: (row) => {
      const net =
        row.premium != null && row.commission != null
          ? row.premium * (1 - row.commission / 100)
          : null;
      return <span className="text-gray-700">{fmtAmount(net, row.currency)}</span>;
    },
  },
  {
    key: 'participants',
    label: 'Participants',
    width: '100px',
    render: (row) => (
      <span className="text-gray-700">
        {row.participants.filter((p) => p.status === 'ACCEPTED' || p.status === 'CLOSED').length}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    width: '110px',
    render: (row) => {
      const display = toDisplayStatus(row.status);
      return <Badge label={display} variant={STATUS_VARIANT_MAP[display] ?? 'neutral'} />;
    },
  },
  {
    key: 'inceptionDate',
    label: 'Period',
    width: '200px',
    render: (row) => (
      <span className="text-gray-500 whitespace-nowrap">
        {fmtDate(row.inceptionDate)} – {fmtDate(row.expiryDate)}
      </span>
    ),
  },
];

interface CedantPlacementsTabProps {
  placements: Facultative[];
  isLoading: boolean;
  tenantSlug: string;
  onEditPlacement: (placement: Facultative) => void;
  onEndorsement: (placement: Facultative) => void;
}

export function CedantPlacementsTab({
  placements,
  isLoading,
  tenantSlug,
  onEditPlacement,
  onEndorsement,
}: CedantPlacementsTabProps) {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const openPlacements = placements.filter((p) => toDisplayStatus(p.status) === 'Open');
  const closedCount = placements.filter((p) => toDisplayStatus(p.status) === 'Closed').length;
  const pendingCount = openPlacements.filter(
    (p) => !p.participants.some((pt) => pt.status === 'ACCEPTED' || pt.status === 'CLOSED'),
  ).length;
  const unpaidCount = openPlacements.filter((p) =>
    p.participants.some((pt) => pt.status === 'ACCEPTED' || pt.status === 'CLOSED'),
  ).length;

  const totalPages = Math.max(1, Math.ceil(placements.length / PAGE_SIZE));
  const paged = placements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Pending Offers" value={pendingCount} sub="Offers not accepted" />
        <StatCard label="Closed Offers" value={closedCount} sub="Offers closed by reinsurers" />
        <StatCard label="Unpaid Offers" value={unpaidCount} sub="Accepted offers by reinsurers" />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Placements</h3>
        <DataTable
          columns={PLACEMENT_COLUMNS}
          data={paged}
          isLoading={isLoading}
          emptyMessage="No placements found for this cedant"
          rowActions={(row) => [
            {
              label: 'View',
              onClick: () =>
                router.push(`/${tenantSlug}/operations/reinsurance/facultative/${row.id}`),
            },
            { label: 'Edit', onClick: () => onEditPlacement(row) },
            {
              label: 'Premiums',
              onClick: () =>
                router.push(`/${tenantSlug}/operations/reinsurance/payments/${row.id}`),
            },
            ...(row.status !== 'CANCELLED'
              ? [{ label: 'Endorsement', onClick: () => onEndorsement(row) }]
              : []),
          ]}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          noInternalScroll
        />
      </div>
    </div>
  );
}
