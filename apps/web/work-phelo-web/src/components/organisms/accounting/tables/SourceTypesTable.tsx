'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { SourceTypePanel } from '@/components/organisms/accounting/panels/SourceTypePanel';
import { useDeleteSourceType, useSourceTypes } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { SourceTypeDefinition } from '@/types/accounting';

const PAGE_SIZE = 10;

export function SourceTypesTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelTarget, setPanelTarget] = useState<SourceTypeDefinition | null | undefined>(
    undefined,
  );
  const [deleteTarget, setDeleteTarget] = useState<SourceTypeDefinition | null>(null);
  const { data = [], isLoading } = useSourceTypes();
  const deleteSourceType = useDeleteSourceType();
  const toast = useToast();

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return !query ? data : data.filter((item) => item.name.toLowerCase().includes(query));
  }, [data, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<SourceTypeDefinition>[] = [
    {
      key: 'name',
      label: 'Name',
      width: 'minmax(180px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'description',
      label: 'Description',
      width: 'minmax(240px, 2fr)',
      render: (row) => <span className="text-sm text-gray-700">{row.description ?? '—'}</span>,
    },
  ];

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteSourceType.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: (error) => toast.error(extractError(error, 'Unable to delete source type')),
    });
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search source types…"
        searchValue={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        actionButton={{ label: 'Add Source Type', onClick: () => setPanelTarget(null) }}
        rowActions={(row) => [
          { label: 'Update', onClick: () => setPanelTarget(row) },
          { label: 'Delete', danger: true, onClick: () => setDeleteTarget(row) },
        ]}
        emptyMessage="No source types found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
      <SourceTypePanel sourceType={panelTarget} onClose={() => setPanelTarget(undefined)} />
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Source Type"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={deleteSourceType.isPending} onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        }
      />
    </>
  );
}
