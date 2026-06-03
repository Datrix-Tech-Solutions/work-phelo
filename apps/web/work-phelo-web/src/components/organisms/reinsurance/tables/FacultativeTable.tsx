'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { CreateFacultativePanel } from '@/components/organisms/reinsurance/panels/CreateFacultativePanel';
import { EditFacultativePanel } from '@/components/organisms/reinsurance/panels/EditFacultativePanel';
import {
  Facultative,
  PlacementDisplayStatus,
  PLACEMENT_DISPLAY_STATUSES,
  toDisplayStatus,
} from '@/types/reinsurance';
import { useFacultatives } from '@/hooks';

const PAGE_SIZE = 10;

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number) {
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const DISPLAY_STATUS_VARIANT_MAP: Record<
  PlacementDisplayStatus,
  'success' | 'warning' | 'neutral' | 'danger'
> = {
  Open: 'warning',
  Closed: 'success',
  Cancelled: 'danger',
};

const STATUS_FILTER_OPTIONS = PLACEMENT_DISPLAY_STATUSES.map((s) => ({ value: s, label: s }));

const COLUMNS: Column<Facultative>[] = [
  {
    key: 'reference',
    label: 'Policy Number',
    width: '1.2fr',
    render: (row) => <span className="font-medium text-gray-900">{row.reference}</span>,
  },
  {
    key: 'cedant',
    label: 'Insurance Company',
    width: '1.5fr',
    render: (row) => <span className="text-gray-700">{row.cedant.name}</span>,
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
    key: 'sumInsured',
    label: 'Sum Insured',
    width: '1.1fr',
    render: (row) => (
      <span className="text-gray-700">
        {row.sumInsured != null ? fmtAmount(row.sumInsured) : '—'}
      </span>
    ),
  },
  {
    key: 'rate',
    label: 'Rate (%)',
    width: '90px',
    render: (row) => (
      <span className="text-gray-700">{row.rate != null ? `${row.rate}%` : '—'}</span>
    ),
  },
  {
    key: 'createdAt',
    label: 'Offer Date',
    width: '1.1fr',
    render: (row) => <span className="text-gray-600">{fmtDate(row.createdAt)}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    width: '110px',
    render: (row) => {
      const display = toDisplayStatus(row.status);
      return <Badge label={display} variant={DISPLAY_STATUS_VARIANT_MAP[display]} />;
    },
  },
];

export function FacultativeTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Facultative | null>(null);

  const { data: allRows = [], isLoading } = useFacultatives();

  const filtered = useMemo(() => {
    let rows = allRows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.reference.toLowerCase().includes(q) ||
          r.cedant.name.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          (r.classOfBusiness?.toLowerCase().includes(q) ?? false),
      );
    }
    if (statusFilter) {
      rows = rows.filter(
        (r) => toDisplayStatus(r.status) === (statusFilter as PlacementDisplayStatus),
      );
    }
    return rows;
  }, [allRows, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search facultative…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        filterOptions={STATUS_FILTER_OPTIONS}
        onFilter={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
        onExport={() => {
          /* TODO: implement export */
        }}
        actionButton={{ label: 'New Offer', onClick: () => setPanelOpen(true) }}
        rowActions={(row) => [
          {
            label: 'View',
            onClick: () =>
              router.push(`/${tenantSlug}/operations/reinsurance/facultative/${row.id}`),
          },
          {
            label: 'Edit Slip',
            onClick: () => setEditTarget(row),
          },
          {
            label: 'Delete',
            onClick: () => {
              /* TODO */
            },
            danger: true,
          },
        ]}
        emptyMessage="No facultative placements found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <CreateFacultativePanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />

      {editTarget && (
        <EditFacultativePanel
          isOpen={!!editTarget}
          placement={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
    </>
  );
}
