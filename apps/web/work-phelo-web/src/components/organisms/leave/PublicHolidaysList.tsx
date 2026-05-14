'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { CreatePublicHolidayPanel } from '@/components/organisms/leave/CreatePublicHolidayPanel';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useDeletePublicHoliday } from '@/hooks/usePublicHolidays';
import { extractError } from '@/lib/extractError';
import { formatHolidayDate } from '@/lib/formatters';
import { PublicHoliday } from '@/types/hr';

interface Props {
  tenantSlug: string;
}

export function PublicHolidaysList({ tenantSlug }: Props) {
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editHoliday, setEditHoliday] = useState<PublicHoliday | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<PublicHoliday | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['public-holidays', { page }],
    queryFn: () => api.get('/hr/leave/public-holidays', { params: { page } }).then((r) => r.data),
  });

  const totalPages: number = data?.totalPages ?? 1;

  const filteredHolidays = useMemo(() => {
    const holidays: PublicHoliday[] = Array.isArray(data)
      ? data
      : (data?.data ?? data?.holidays ?? []);
    if (!search) return holidays;
    const q = search.toLowerCase();
    return holidays.filter((h) => h.name.toLowerCase().includes(q));
  }, [data, search]);

  const { mutate: deleteHoliday, isPending: isDeleting } = useDeletePublicHoliday();
  const formatScope = (holiday: PublicHoliday) => {
    if (holiday.countryScope) {
      return holiday.countryScope
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
    return 'Company-wide';
  };

  const columns: Column<PublicHoliday>[] = [
    {
      key: 'name',
      label: 'Holiday Name',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'date',
      label: 'Official Date',
      render: (row) => <span className="text-gray-700">{formatHolidayDate(row.date)}</span>,
    },
    {
      key: 'observedDate',
      label: 'Observed',
      render: (row) => (
        <div>
          <span className="text-gray-700">{formatHolidayDate(row.observedDate ?? row.date)}</span>
          {row.isObservedShifted && <p className="text-xs text-amber-600">shifted from weekend</p>}
        </div>
      ),
    },
    {
      key: 'countryScope',
      label: 'Scope',
      render: (row) => <span className="text-gray-600">{formatScope(row)}</span>,
    },
    {
      key: '_view',
      label: '',
      width: '72px',
      render: (row) => (
        <div className="flex justify-center">
          <button
            onClick={() => {
              setEditHoliday(row);
              setPanelOpen(true);
            }}
            className="text-sm font-medium px-2 py-1 rounded-lg text-brand hover:bg-brand/5 transition-colors"
          >
            View
          </button>
        </div>
      ),
    },
    {
      key: '_delete',
      label: '',
      width: '72px',
      render: (row) => (
        <div className="flex justify-center">
          <button
            onClick={() => setDeleteTarget(row)}
            className="text-sm font-medium px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={filteredHolidays}
        isLoading={isLoading}
        searchPlaceholder="Search holidays..."
        onSearch={setSearch}
        actionButton={{
          label: 'Add Holiday',
          onClick: () => {
            setEditHoliday(undefined);
            setPanelOpen(true);
          },
        }}
        emptyMessage="No public holidays added yet"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
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
              onClick={() =>
                deleteTarget &&
                deleteHoliday(deleteTarget.id, {
                  onSuccess: () => {
                    toast.success('Holiday deleted');
                    setDeleteTarget(null);
                  },
                  onError: (err) => toast.error(extractError(err, 'Something went wrong')),
                })
              }
            >
              Delete
            </Button>
          </div>
        }
      />
    </>
  );
}
