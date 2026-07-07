'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { BankAccount } from '@/types/accounting';
import { AddAccountPanel } from '@/components/organisms/accounting/panels/AddAccountPanel';

const PAGE_SIZE = 10;

// TODO: replace with useBankAccounts() hook once API is ready
const MOCK_DATA: BankAccount[] = [];

const COLUMNS: Column<BankAccount>[] = [
  {
    key: 'accountName',
    label: 'Account Name',
    width: '1fr',
    render: (row) => <span className="font-medium text-gray-900">{row.accountName}</span>,
  },
  {
    key: 'accountType',
    label: 'Account Type',
    width: '140px',
    render: (row) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
        {row.accountType}
      </span>
    ),
  },
  {
    key: 'bankName',
    label: 'Bank Name',
    width: '1fr',
    render: (row) => <span className="text-sm text-gray-700">{row.bankName}</span>,
  },
  {
    key: 'bankCode',
    label: 'Bank Code',
    width: '120px',
    render: (row) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
        {row.bankCode}
      </span>
    ),
  },
  {
    key: 'accountNumber',
    label: 'Account Number',
    width: '160px',
    render: (row) => <span className="text-sm text-gray-700 font-mono">{row.accountNumber}</span>,
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

export function BankAccountsTable() {
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
        r.accountName.toLowerCase().includes(q) ||
        r.bankName.toLowerCase().includes(q) ||
        r.accountNumber.toLowerCase().includes(q) ||
        r.bankCode.toLowerCase().includes(q),
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
        searchPlaceholder="Search accounts…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{ label: 'Add Account', onClick: () => setPanelOpen(true) }}
        rowActions={() => [
          { label: 'Edit', onClick: () => {} },
          { label: 'Delete', onClick: () => {}, danger: true },
        ]}
        onRowClick={(row) => router.push(`/${tenantSlug}/accounting/settings/accounts/${row.id}`)}
        emptyMessage="No accounts found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <AddAccountPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
