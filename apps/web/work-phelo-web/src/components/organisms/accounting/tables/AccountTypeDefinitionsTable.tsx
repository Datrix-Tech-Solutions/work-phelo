'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { AddAccountTypePanel } from '@/components/organisms/accounting/panels/AddAccountTypePanel';
import { AccountTypeDefinition } from '@/types/accounting';

const PAGE_SIZE = 10;

// TODO: replace with useAccountTypeDefinitions() hook once API is ready
const MOCK_DATA: AccountTypeDefinition[] = [];

const COLUMNS: Column<AccountTypeDefinition>[] = [
  {
    key: 'name',
    label: 'Account Type Name',
    width: '1fr',
    render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
  },
  {
    key: 'description',
    label: 'Description',
    width: '2fr',
    render: (row) => <span className="text-sm text-gray-700">{row.description ?? '—'}</span>,
  },
];

export function AccountTypeDefinitionsTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AccountTypeDefinition | null>(null);

  const filtered = useMemo(() => {
    if (!search) return MOCK_DATA;
    const q = search.toLowerCase();
    return MOCK_DATA.filter((r) => r.name.toLowerCase().includes(q));
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={false}
        searchPlaceholder="Search account types…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{ label: 'Add Account Type', onClick: () => setPanelOpen(true) }}
        rowActions={(row) => [
          { label: 'Edit', onClick: () => {} },
          { label: 'Delete', onClick: () => setDeleteTarget(row), danger: true },
        ]}
        emptyMessage="No account types found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <AddAccountTypePanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Account Type"
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
