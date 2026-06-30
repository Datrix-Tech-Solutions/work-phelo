'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { AccountTypePill } from '@/components/molecules/accounting/AccountTypePill';
import { RegisterAccountPanel } from '@/components/organisms/accounting/panels/RegisterAccountPanel';
import { ChartOfAccount } from '@/types/accounting';

const PAGE_SIZE = 10;

const TYPE_OPTIONS: SearchSelectOption[] = [
  { value: 'Asset', label: 'Asset' },
  { value: 'Liability', label: 'Liability' },
  { value: 'Equity', label: 'Equity' },
  { value: 'Revenue', label: 'Revenue' },
  { value: 'Expense', label: 'Expense' },
];

const STATUS_OPTIONS: SearchSelectOption[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

const CURRENCY_OPTIONS: SearchSelectOption[] = [
  { value: 'GHS', label: 'GHS' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
];

const MOCK_DATA: ChartOfAccount[] = [];

const COLUMNS: Column<ChartOfAccount>[] = [
  {
    key: 'accountCode',
    label: 'Account Code',
    width: '140px',
    render: (row) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
        {row.accountCode}
      </span>
    ),
  },
  {
    key: 'accountName',
    label: 'Account Name',
    width: '1fr',
    render: (row) => <span className="font-medium text-gray-900">{row.accountName}</span>,
  },
  {
    key: 'type',
    label: 'Type',
    width: '120px',
    render: (row) => <AccountTypePill type={row.type} />,
  },
  {
    key: 'parentAccount',
    label: 'Parent Account',
    width: '1fr',
    render: (row) => <span className="text-gray-600 text-sm">{row.parentAccount ?? '—'}</span>,
  },
  {
    key: 'currency',
    label: 'Currency',
    width: '100px',
    render: (row) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
        {row.currency}
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

export function ChartOfAccountsTable() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);

  const filtered = useMemo(() => {
    let rows = MOCK_DATA;
    if (typeFilter) rows = rows.filter((r) => r.type === typeFilter);
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
    if (currencyFilter) rows = rows.filter((r) => r.currency === currencyFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.accountCode.toLowerCase().includes(q) ||
          r.accountName.toLowerCase().includes(q) ||
          (r.parentAccount ?? '').toLowerCase().includes(q),
      );
    }
    return rows;
  }, [search, typeFilter, statusFilter, currencyFilter]);

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
        extraFilters={
          <>
            <div className="w-40">
              <SearchSelect
                placeholder="All types"
                size="sm"
                options={TYPE_OPTIONS}
                value={typeFilter}
                onChange={(v) => {
                  setTypeFilter(v);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-36">
              <SearchSelect
                placeholder="All currencies"
                size="sm"
                options={CURRENCY_OPTIONS}
                value={currencyFilter}
                onChange={(v) => {
                  setCurrencyFilter(v);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-36">
              <SearchSelect
                placeholder="All statuses"
                size="sm"
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              />
            </div>
          </>
        }
        actionButton={{ label: 'Register Account', onClick: () => setPanelOpen(true) }}
        emptyMessage="No accounts found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <RegisterAccountPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
