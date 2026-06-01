'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { AddRiskTypePanel } from '@/components/organisms/reinsurance/panels/AddRiskTypePanel';
import { useRiskTypes, useDeleteRiskType, useRiskClassOptions } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { RiskType } from '@/types/reinsurance';

const PAGE_SIZE = 10;

const COLUMNS: Column<RiskType>[] = [
  {
    key: 'name',
    label: 'Risk Type',
    width: '2fr',
    render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
  },
  {
    key: 'description',
    label: 'Description',
    width: '3fr',
    render: (row) => <span className="text-gray-500 text-sm">{row.description ?? '—'}</span>,
  },
  {
    key: 'isActive',
    label: 'Status',
    width: '1fr',
    render: (row) => (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
          row.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}
      >
        {row.isActive ? 'Active' : 'Inactive'}
      </span>
    ),
  },
];

export function RiskTypesTable() {
  const toast = useToast();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RiskType | null>(null);

  const { data: riskClassOptions = [] } = useRiskClassOptions();
  const { data = [], isLoading } = useRiskTypes(selectedClassId);
  const { mutate: deleteRiskType, isPending: isDeleting } = useDeleteRiskType();

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((r) => r.name.toLowerCase().includes(q));
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteRiskType(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Risk type deleted successfully');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to delete risk type')),
    });
  };

  return (
    <>
      <div className="mb-4 max-w-xs">
        <SearchSelect
          label="Filter by Risk Class"
          placeholder="Select a risk class…"
          value={selectedClassId}
          onChange={(v) => {
            setSelectedClassId(v);
            setPage(1);
            setSearch('');
          }}
          options={riskClassOptions}
        />
      </div>

      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={isLoading && !!selectedClassId}
        searchPlaceholder="Search risk types…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{
          label: 'Add Risk Type',
          onClick: () => setPanelOpen(true),
        }}
        rowActions={(row) => [
          {
            label: 'Delete',
            onClick: () => setDeleteTarget(row),
            danger: true,
          },
        ]}
        emptyMessage={
          selectedClassId ? 'No risk types found' : 'Select a risk class to view its types'
        }
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AddRiskTypePanel
        isOpen={panelOpen}
        defaultRiskClassId={selectedClassId}
        onClose={() => setPanelOpen(false)}
      />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Risk Type"
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
