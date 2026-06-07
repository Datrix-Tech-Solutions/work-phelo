'use client';

import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';

export interface ReinsurerParticipation {
  id: string;
  reference: string;
  title: string;
  cedant: string;
  role: string;
  sharePercent: string | null;
  participantStatus: string;
  inceptionDate: string | null;
  expiryDate: string | null;
}

interface ReinsurerPoliciesTableProps {
  data: ReinsurerParticipation[];
  isLoading?: boolean;
  onRowClick?: (id: string) => void;
}

const PAGE_SIZE = 10;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'ACCEPTED':
    case 'CLOSED':
      return 'success';
    case 'QUOTED':
      return 'warning';
    case 'DECLINED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function formatRole(role: string): string {
  switch (role) {
    case 'LEAD_REINSURER':
      return 'Lead';
    case 'CO_REINSURER':
      return 'Co-Reinsurer';
    case 'REINSURER':
      return 'Reinsurer';
    case 'BROKER':
      return 'Broker';
    default:
      return role;
  }
}

const COLUMNS: Column<ReinsurerParticipation>[] = [
  {
    key: 'reference',
    label: 'Reference',
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
    key: 'cedant',
    label: 'Cedant',
    width: '1.5fr',
    render: (row) => <span className="text-gray-600">{row.cedant}</span>,
  },
  {
    key: 'role',
    label: 'Role',
    width: '120px',
    render: (row) => <span className="text-gray-600">{formatRole(row.role)}</span>,
  },
  {
    key: 'sharePercent',
    label: 'Share (%)',
    width: '100px',
    render: (row) => (
      <span className="text-gray-700">
        {row.sharePercent != null ? `${row.sharePercent}%` : '—'}
      </span>
    ),
  },
  {
    key: 'participantStatus',
    label: 'Status',
    width: '120px',
    render: (row) => (
      <Badge
        label={statusLabel(row.participantStatus)}
        variant={statusVariant(row.participantStatus)}
      />
    ),
  },
  {
    key: 'period',
    label: 'Period',
    width: '1.2fr',
    render: (row) => (
      <span className="text-gray-500 whitespace-nowrap">
        {formatDate(row.inceptionDate)} – {formatDate(row.expiryDate)}
      </span>
    ),
  },
];

export function ReinsurerPoliciesTable({
  data,
  isLoading,
  onRowClick,
}: ReinsurerPoliciesTableProps) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const paged = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DataTable
      columns={COLUMNS}
      data={paged}
      isLoading={isLoading}
      emptyMessage="No placements found for this reinsurer"
      onRowClick={onRowClick ? (row) => onRowClick(row.id) : undefined}
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
      noInternalScroll
    />
  );
}
