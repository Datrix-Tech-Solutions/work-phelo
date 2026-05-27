'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { AddRiskClassPanel } from '@/components/organisms/reinsurance/panels/AddRiskClassPanel';
import { useRiskClasses, useDeleteRiskClass } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { RiskClass } from '@/types/reinsurance';

const PAGE_SIZE = 10;

const COLUMNS: Column<RiskClass>[] = [
  {
    key: 'name',
    label: 'Class Name',
    width: '2fr',
    render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
  },
  {
    key: 'createdBy',
    label: 'Created By',
    width: '2fr',
    render: (row) => <span className="text-gray-700">{row.createdBy}</span>,
  },
];

export function RiskClassesTable() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RiskClass | null>(null);

  const { data = [], isLoading } = useRiskClasses();
  const { mutate: deleteRiskClass, isPending: isDeleting } = useDeleteRiskClass();

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      (r) => r.name.toLowerCase().includes(q) || r.createdBy.toLowerCase().includes(q),
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteRiskClass(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Risk class deleted successfully');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to delete risk class')),
    });
  };

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search risk classes…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{ label: 'Add Risk Class', onClick: () => setPanelOpen(true) }}
        rowActions={(row) => [
          {
            label: 'Edit',
            onClick: () => {
              /* TODO: open edit panel */
            },
          },
          {
            label: 'Delete',
            onClick: () => setDeleteTarget(row),
            danger: true,
          },
        ]}
        emptyMessage="No risk classes found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AddRiskClassPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Risk Class"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting…"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        }
      />
    </>
  );
}
