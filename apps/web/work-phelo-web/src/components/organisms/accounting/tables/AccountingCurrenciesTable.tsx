'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { AccountingCurrency } from '@/types/accounting';

const PAGE_SIZE = 10;

// TODO: replace with useAccountingCurrencies() hook once API is ready
const MOCK_DATA: AccountingCurrency[] = [];

const COLUMNS: Column<AccountingCurrency>[] = [
  {
    key: 'name',
    label: 'Currency',
    width: '0.8fr',
    render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
  },
  {
    key: 'symbol',
    label: 'Symbol',
    width: '200px',
    render: (row) => <span className="font-medium text-gray-900">{row.symbol}</span>,
  },
  {
    key: 'isoCode',
    label: 'ISO Code',
    width: '200px',
    render: (row) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
        {row.isoCode}
      </span>
    ),
  },
  {
    key: 'exchangeRateToBase',
    label: 'Exchange Rate',
    width: '200px',
    render: (row) => (
      <span className="text-gray-700 text-sm">
        {row.isBaseCurrency
          ? 'Base'
          : row.exchangeRateToBase
            ? parseFloat(row.exchangeRateToBase).toFixed(4)
            : '—'}
      </span>
    ),
  },
];

export function AccountingCurrenciesTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<AccountingCurrency | null>(null);

  const filtered = useMemo(() => {
    if (!search) return MOCK_DATA;
    const q = search.toLowerCase();
    return MOCK_DATA.filter(
      (r) => r.name.toLowerCase().includes(q) || r.isoCode.toLowerCase().includes(q),
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
        searchPlaceholder="Search currencies…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{
          label: 'Add Currency',
          onClick: () => {
            // TODO: open AddCurrencyPanel once built
          },
        }}
        rowActions={(row) => [
          { label: 'Edit', onClick: () => {} },
          { label: 'Delete', onClick: () => setDeleteTarget(row), danger: true },
        ]}
        emptyMessage="No currencies found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        // noInternalScroll
      />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Currency"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setDeleteTarget(null)}>
              Delete
            </Button>
          </div>
        }
      />
    </>
  );
}
