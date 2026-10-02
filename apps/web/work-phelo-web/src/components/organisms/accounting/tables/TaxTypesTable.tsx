'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { TaxTypePanel } from '@/components/organisms/accounting/panels/TaxTypePanel';
import { useDeleteTaxType, useTaxTypes } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { TaxType } from '@/types/accounting';

const PAGE_SIZE = 10;

function fmtDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export function TaxTypesTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelTarget, setPanelTarget] = useState<TaxType | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<TaxType | null>(null);
  const { data = [], isLoading } = useTaxTypes();
  const deleteTaxType = useDeleteTaxType();
  const toast = useToast();

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return !query
      ? data
      : data.filter(
          (item) =>
            item.code.toLowerCase().includes(query) || item.name.toLowerCase().includes(query),
        );
  }, [data, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<TaxType>[] = [
    {
      key: 'code',
      label: 'Code',
      width: '100px',
      render: (row) => <span className="text-sm text-gray-700">{row.code}</span>,
    },
    {
      key: 'name',
      label: 'Name',
      width: 'minmax(120px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'rate',
      label: 'Rate',
      width: '100px',
      render: (row) => <span className="text-sm text-gray-700">{row.rate}%</span>,
    },
    {
      key: 'effectiveFrom',
      label: 'Effective From',
      width: '130px',
      render: (row) => <span className="text-sm text-gray-700">{fmtDate(row.effectiveFrom)}</span>,
    },
    {
      key: 'effectiveTo',
      label: 'Effective To',
      width: '130px',
      render: (row) => <span className="text-sm text-gray-700">{fmtDate(row.effectiveTo)}</span>,
    },
  ];

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteTaxType.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: (error) => toast.error(extractError(error, 'Unable to delete tax type')),
    });
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search tax types…"
        searchValue={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        actionButton={{ label: 'Add Tax Type', onClick: () => setPanelTarget(null) }}
        rowActions={(row) => [
          { label: 'Update', onClick: () => setPanelTarget(row) },
          { label: 'Delete', danger: true, onClick: () => setDeleteTarget(row) },
        ]}
        emptyMessage="No tax types found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
      <TaxTypePanel taxType={panelTarget} onClose={() => setPanelTarget(undefined)} />
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Tax Type"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={deleteTaxType.isPending} onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        }
      />
    </>
  );
}
