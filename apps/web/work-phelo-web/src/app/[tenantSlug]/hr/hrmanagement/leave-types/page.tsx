// HR MANAGEMENT LEAVETYPES //

'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Modal } from '@/components/organisms/Modal';
import { Button } from '@/components/atoms/Button';
import { CreateLeaveTypePanel } from '@/components/organisms/leave/CreateLeaveTypePanel';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { LeaveType } from '@/types/leave';

export default function LeaveTypesPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const toast = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editLeaveType, setEditLeaveType] = useState<LeaveType | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<LeaveType | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['leave-types', tenantSlug, page, search],
    queryFn: () =>
      api
        .get(`/hr/leave/types`, {
          params: { page, search: search || undefined },
        })
        .then((r) => r.data),
  });

  const leaveTypes: LeaveType[] = Array.isArray(data)
    ? data
    : (data?.data ?? data?.leaveTypes ?? []);
  const totalPages: number = data?.totalPages ?? 1;

  const { mutate: deleteLeaveType, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/leave/types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types', tenantSlug] });
      toast.success('Leave type deleted');
      setDeleteTarget(null);
    },
    onError: (err) => {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'Something went wrong';
      toast.error(message);
    },
  });

  const columns: Column<LeaveType>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'isPaid',
      label: 'Paid',
      render: (row) => (
        <Badge variant={row.isPaid ? 'success' : 'neutral'} label={row.isPaid ? 'Yes' : 'No'} />
      ),
    },
    {
      key: 'daysAllowed',
      label: 'Days / Year',
      render: (row) => <span className="text-gray-700">{row.daysAllowed}</span>,
    },
    {
      key: 'isCarryOver',
      label: 'Carry Over',
      render: (row) => (
        <span className="text-gray-700">
          {row.isCarryOver
            ? row.maxCarryOverDays
              ? `Yes (max ${row.maxCarryOverDays})`
              : 'Yes'
            : 'No'}
        </span>
      ),
    },
    {
      key: 'requiresApproval',
      label: 'Requires Approval',
      render: (row) => (
        <Badge
          variant={row.requiresApproval ? 'warning' : 'neutral'}
          label={row.requiresApproval ? 'Yes' : 'No'}
        />
      ),
    },
  ];

  const openCreate = () => {
    setEditLeaveType(undefined);
    setPanelOpen(true);
  };

  const openEdit = (leaveType: LeaveType) => {
    setEditLeaveType(leaveType);
    setPanelOpen(true);
  };

  return (
    <>
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-900">Leave Types</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Define the types of leave employees can request
        </p>
      </div>

      <DataTable
        columns={columns}
        data={leaveTypes}
        isLoading={isLoading}
        searchPlaceholder="Search leave types..."
        onSearch={setSearch}
        actionButton={{ label: 'Add Leave Type', onClick: openCreate }}
        emptyMessage="No leave types found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        rowActions={(row) => [
          { label: 'Edit', onClick: () => openEdit(row) },
          ...(row.isDefault
            ? []
            : [{ label: 'Delete', danger: true, onClick: () => setDeleteTarget(row) }]),
        ]}
      />

      <CreateLeaveTypePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        tenantSlug={tenantSlug}
        editLeaveType={editLeaveType}
      />

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Leave Type"
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
              onClick={() => deleteTarget && deleteLeaveType(deleteTarget.id)}
            >
              Delete
            </Button>
          </div>
        }
      />
    </>
  );
}
