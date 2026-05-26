'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Broker } from '@/types/reinsurance';
import { AddBrokerPanel } from '../panels/AddBrokerPanel';

const PAGE_SIZE = 10;

// TODO: replace with useCedants() hook once API is ready
const MOCK_DATA: Broker[] = [];

const COLUMNS: Column<Broker>[] = [
  {
    key: 'name',
    label: 'Broker Name',
    width: '2fr',
    render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
  },
  {
    key: 'email',
    label: 'Email',
    width: '2fr',
    render: (row) => <span className="text-gray-700">{row.email}</span>,
  },
  {
    key: 'phoneNumber',
    label: 'Phone Number',
    width: '1.5fr',
    render: (row) => <span className="text-gray-700">{row.phoneNumber}</span>,
  },
];

export function BrokersTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return MOCK_DATA;
    const q = search.toLowerCase();
    return MOCK_DATA.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.phoneNumber.includes(q),
    );
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        searchPlaceholder="Search cedants…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{ label: 'Add Broker', onClick: () => setPanelOpen(true) }}
        rowActions={() => [
          {
            label: 'Edit',
            onClick: () => {
              /* TODO */
            },
          },
          {
            label: 'Delete',
            onClick: () => {
              /* TODO */
            },
            danger: true,
          },
        ]}
        emptyMessage="No brokers found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AddBrokerPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
