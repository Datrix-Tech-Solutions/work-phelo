// HR MANAGEMENT PUBLIC HOLIDAYS PAGE //

'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { Modal } from '@/components/organisms/Modal';
import { Button } from '@/components/atoms/Button';
import { CreatePublicHolidayPanel } from '@/components/organisms/leave/CreatePublicHolidayPanel';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { PublicHoliday } from '@/types/leave';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function daysBetween(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

export default function PublicHolidaysPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const toast = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editHoliday, setEditHoliday] = useState<PublicHoliday | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<PublicHoliday | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['public-holidays', tenantSlug, page, search],
    queryFn: () =>
      api
        .get(`/${tenantSlug}/public-holidays`, {
          params: { page, search: search || undefined },
        })
        .then((r) => r.data),
  });

  const holidays: PublicHoliday[] = Array.isArray(data)
    ? data
    : (data?.data ?? data?.holidays ?? []);
  const totalPages: number = data?.totalPages ?? 1;

  const { mutate: deleteHoliday, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => api.delete(`/${tenantSlug}/public-holidays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-holidays', tenantSlug] });
      toast.success('Holiday deleted');
      setDeleteTarget(null);
    },
    onError: (err) => {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'Something went wrong';
      toast.error(message);
    },
  });

  const columns: Column<PublicHoliday>[] = [
    {
      key: 'name',
      label: 'Holiday Name',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'startDate',
      label: 'Start Date',
      render: (row) => <span className="text-gray-700">{formatDate(row.startDate)}</span>,
    },
    {
      key: 'endDate',
      label: 'End Date',
      render: (row) => <span className="text-gray-700">{formatDate(row.endDate)}</span>,
    },
    {
      key: 'duration',
      label: 'Duration',
      render: (row) => {
        const days = daysBetween(row.startDate, row.endDate);
        return (
          <span className="text-gray-500 text-sm">{days === 1 ? '1 day' : `${days} days`}</span>
        );
      },
    },
  ];

  const openCreate = () => {
    setEditHoliday(undefined);
    setPanelOpen(true);
  };

  const openEdit = (holiday: PublicHoliday) => {
    setEditHoliday(holiday);
    setPanelOpen(true);
  };

  return (
    <>
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-900">Public Holidays</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage public holidays — these days are automatically excluded from leave calculations
        </p>
      </div>

      <DataTable
        columns={columns}
        data={holidays}
        isLoading={isLoading}
        searchPlaceholder="Search holidays..."
        onSearch={setSearch}
        actionButton={{ label: 'Add Holiday', onClick: openCreate }}
        emptyMessage="No public holidays added yet"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        rowActions={(row) => [
          { label: 'Edit', onClick: () => openEdit(row) },
          { label: 'Delete', danger: true, onClick: () => setDeleteTarget(row) },
        ]}
      />

      <CreatePublicHolidayPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        tenantSlug={tenantSlug}
        editHoliday={editHoliday}
      />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Public Holiday"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting..."
              onClick={() => deleteTarget && deleteHoliday(deleteTarget.id)}
            >
              Delete
            </Button>
          </div>
        }
      />
    </>
  );
}
