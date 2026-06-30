'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { AddVendorPanel } from '@/components/organisms/accounting/panels/AddVendorPanel';
import { Vendor } from '@/types/accounting';

const PAGE_SIZE = 10;

// TODO: replace with useVendors() hook once API is ready
const MOCK_DATA: Vendor[] = [];

function fmtBalance(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const COLUMNS: Column<Vendor>[] = [
  {
    key: 'vendorCode',
    label: 'Vendor Code',
    width: '130px',
    render: (row) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
        {row.vendorCode}
      </span>
    ),
  },
  {
    key: 'vendorName',
    label: 'Vendor Name',
    width: '1fr',
    render: (row) => <span className="font-medium text-gray-900">{row.vendorName}</span>,
  },
  {
    key: 'contactPerson',
    label: 'Contact Person',
    width: '1fr',
    render: (row) => <span className="text-gray-700 text-sm">{row.contactPerson ?? '—'}</span>,
  },
  {
    key: 'email',
    label: 'Email',
    width: '1fr',
    render: (row) => <span className="text-gray-600 text-sm">{row.email ?? '—'}</span>,
  },
  {
    key: 'phone',
    label: 'Phone',
    width: '130px',
    render: (row) => <span className="text-gray-600 text-sm">{row.phone ?? '—'}</span>,
  },
  {
    key: 'outstandingBalance',
    label: 'Outstanding Balance',
    width: '1fr',
    render: (row) => (
      <span className="text-sm text-gray-700">
        {fmtBalance(row.outstandingBalance, row.currency)}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    width: '100px',
    render: (row) => (
      <Badge label={row.status} variant={row.status === 'Active' ? 'success' : 'neutral'} />
    ),
  },
];

export function VendorsTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return MOCK_DATA;
    const q = search.toLowerCase();
    return MOCK_DATA.filter(
      (r) =>
        r.vendorCode.toLowerCase().includes(q) ||
        r.vendorName.toLowerCase().includes(q) ||
        (r.contactPerson ?? '').toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q),
    );
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={false}
        searchPlaceholder="Search vendors…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        onRowClick={(row) => router.push(`/${tenantSlug}/accounting/settings/vendors/${row.id}`)}
        actionButton={{ label: 'Add Vendor', onClick: () => setPanelOpen(true) }}
        rowActions={() => [
          { label: 'Edit', onClick: () => {} },
          { label: 'Delete', onClick: () => {}, danger: true },
        ]}
        emptyMessage="No vendors found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <AddVendorPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
