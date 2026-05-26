'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Reinsurer } from '@/types/reinsurance';
import { AddReinsurancePanel } from '../panels/AddReinsurancepanel';

const PAGE_SIZE = 10;

// TODO: replace with useCedants() hook once API is ready
const MOCK_DATA: Reinsurer[] = [];

const COLUMNS: Column<Reinsurer>[] = [
  {
    key: 'name',
    label: 'Reinsurer Name',
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

export function ReinsurersTable() {
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
        searchPlaceholder="Search reinsurers…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{ label: 'Add Reinsurer', onClick: () => setPanelOpen(true) }}
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
        emptyMessage="No reinsurers found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AddReinsurancePanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
