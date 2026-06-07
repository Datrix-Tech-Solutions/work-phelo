'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect } from '@/components/atoms/SearchSelect';
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

function fmtAmount(val: number | null | undefined) {
  if (val == null) return '—';
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const OFFER_STATUS_VARIANT_MAP: Record<
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
    width: '1.1fr',
    render: (row) => <span className="font-medium text-gray-900">{row.reference}</span>,
  },
  {
    key: 'classOfBusiness',
    label: 'Risk Type',
    width: '1fr',
    render: (row) => <span className="text-gray-600">{row.classOfBusiness ?? '—'}</span>,
  },
  {
    key: 'title',
    label: 'Insured',
    width: '1.3fr',
    render: (row) => <span className="text-gray-700">{row.title}</span>,
  },
  {
    key: 'sumInsured',
    label: 'Sum Insured',
    width: '1fr',
    render: (row) => <span className="text-gray-700">{fmtAmount(row.sumInsured)}</span>,
  },
  {
    key: 'facultativeOffer',
    label: 'Fac. Sum Insured',
    width: '1fr',
    render: (row) => {
      const facSumInsured =
        row.sumInsured != null && row.facultativeOffer != null
          ? row.sumInsured * (row.facultativeOffer / 100)
          : null;
      return <span className="text-gray-700">{fmtAmount(facSumInsured)}</span>;
    },
  },
  {
    key: 'premium',
    label: 'Net Premium',
    width: '1fr',
    render: (row) => <span className="text-gray-700">{fmtAmount(row.premium)}</span>,
  },
  {
    key: 'collectedToDate' as keyof Facultative,
    label: 'Amount payed',
    width: '1fr',
    render: () => <span className="text-gray-400">—</span>,
  },
  {
    key: 'outstanding' as keyof Facultative,
    label: 'Outstanding',
    width: '1fr',
    render: () => <span className="text-gray-400">—</span>,
  },
  {
    key: 'commission',
    label: 'Commission',
    width: '1fr',
    render: (row) => <span className="text-gray-700">{fmtAmount(row.commission)}</span>,
  },
  {
    key: 'status',
    label: 'Offer Status',
    width: '110px',
    render: (row) => {
      const display = toDisplayStatus(row.status);
      return <Badge label={display} variant={OFFER_STATUS_VARIANT_MAP[display]} />;
    },
  },
  {
    key: 'paymentStatus' as keyof Facultative,
    label: 'Payment Status',
    width: '120px',
    render: () => <Badge label="Pending" variant="neutral" />,
  },
  {
    key: 'createdAt',
    label: 'Offer Date',
    width: '1fr',
    render: (row) => <span className="text-gray-600">{fmtDate(row.createdAt)}</span>,
  },
];

export function PaymentsTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cedantFilter, setCedantFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: allRows = [], isLoading } = useFacultatives();

  const cedantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of allRows) seen.set(r.cedant.id, r.cedant.name);
    return Array.from(seen.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allRows]);

  const filtered = useMemo(() => {
    let rows = allRows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.reference.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          (r.classOfBusiness?.toLowerCase().includes(q) ?? false),
      );
    }
    if (statusFilter) {
      rows = rows.filter(
        (r) => toDisplayStatus(r.status) === (statusFilter as PlacementDisplayStatus),
      );
    }
    if (cedantFilter) {
      rows = rows.filter((r) => r.cedant.id === cedantFilter);
    }
    return rows;
  }, [allRows, search, statusFilter, cedantFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const cedantDropdown = (
    <div>
      <SearchSelect
        size="sm"
        placeholder="Cedants"
        options={cedantOptions}
        value={cedantFilter}
        onChange={(v) => {
          setCedantFilter(v);
          setPage(1);
        }}
      />
    </div>
  );

  return (
    <DataTable
      columns={COLUMNS}
      data={paged}
      isLoading={isLoading}
      searchPlaceholder="Search payments…"
      searchValue={search}
      onRowClick={(row) => router.push(`/${tenantSlug}/operations/reinsurance/payments/${row.id}`)}
      onSearch={(q) => {
        setSearch(q);
        setPage(1);
      }}
      extraFilters={cedantDropdown}
      filterOptions={STATUS_FILTER_OPTIONS}
      onFilter={(v) => {
        setStatusFilter(v);
        setPage(1);
      }}
      actionButton={{
        label: 'Make Payment',
        onClick: () => router.push(`/${tenantSlug}/operations/reinsurance/payments/new`),
      }}
      rowActions={(row) => [
        {
          label: 'Record Payment',
          onClick: () => router.push(`/${tenantSlug}/operations/reinsurance/payments/${row.id}`),
        },
        { label: 'View', onClick: () => {} },
      ]}
      emptyMessage="No payment records found"
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
      noInternalScroll
    />
  );
}
