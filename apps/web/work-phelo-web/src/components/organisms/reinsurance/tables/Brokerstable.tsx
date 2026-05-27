'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { AddBrokerPanel } from '@/components/organisms/reinsurance/panels/AddBrokerPanel';
import { useBrokers, useDeleteBroker } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { Broker } from '@/types/reinsurance';

const PAGE_SIZE = 10;

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
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Broker | null>(null);

  const { data = [], isLoading } = useBrokers();
  const { mutate: deleteBroker, isPending: isDeleting } = useDeleteBroker();

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.phoneNumber.includes(q),
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteBroker(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Broker deleted successfully');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to delete broker')),
    });
  };

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search brokers…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{ label: 'Add Broker', onClick: () => setPanelOpen(true) }}
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
        emptyMessage="No brokers found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AddBrokerPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Broker"
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
