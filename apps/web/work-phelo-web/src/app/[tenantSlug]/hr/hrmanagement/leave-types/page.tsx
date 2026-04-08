// HR MANAGEMENT LEAVETYPES //

'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Modal } from '@/components/organisms/Modal';
import { CreateLeaveTypePanel } from '@/components/organisms/leave/CreateLeaveTypePanel';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { LeaveType } from '@/types/leave';

const APPLICABILITY_LABELS: Record<string, string> = {
  All: 'All Employees',
  FullTime: 'Full-time',
  PartTime: 'Part-time',
  Contract: 'Contract',
};

export default function LeaveTypesPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editLeaveType, setEditLeaveType] = useState<LeaveType | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<LeaveType | null>(null);
  const [warnTarget, setWarnTarget] = useState<LeaveType | null>(null);

  // Fetch Leave Types
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

  const totalPages = data?.totalPages ?? 1;

  // Delete Mutation
  const { mutate: deleteLeaveType, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/leave/types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      toast.success('Leave type deleted successfully');
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || 'Failed to delete leave type';
      toast.error(message);
    },
  });

  // Table Columns
  const columns: Column<LeaveType>[] = [
    {
      key: 'name',
      label: 'Leave Type',
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
      key: 'daysPerYear',
      label: 'Days / Year',
      render: (row) => <span className="font-medium">{row.daysPerYear}</span>,
    },
    {
      key: 'carryOver',
      label: 'Carry Over',
      render: (row) => (
        <span className="text-gray-700">
          {row.carryOver
            ? row.maxCarryOverDays
              ? `Yes (max ${row.maxCarryOverDays})`
              : 'Yes'
            : 'No'}
        </span>
      ),
    },
    {
      key: 'applicableTo',
      label: 'Applicable To',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {(row.applicableTo ?? []).map((a) => (
            <Badge key={a} variant="neutral" label={APPLICABILITY_LABELS[a] ?? a} />
          ))}
        </div>
      ),
    },
    {
      key: 'requiresDocumentation',
      label: 'Docs Required',
      render: (row) => (
        <Badge
          variant={row.requiresDocumentation ? 'warning' : 'neutral'}
          label={row.requiresDocumentation ? 'Yes' : 'No'}
        />
      ),
    },
  ];

  const openCreate = () => {
    setEditLeaveType(undefined);
    setPanelOpen(true);
  };

  const openEdit = (leaveType: LeaveType) => {
    if (leaveType.hasExistingRequests) {
      setWarnTarget(leaveType);
    } else {
      setEditLeaveType(leaveType);
      setPanelOpen(true);
    }
  };

  const confirmEdit = () => {
    if (warnTarget) {
      setEditLeaveType(warnTarget);
      setWarnTarget(null);
      setPanelOpen(true);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Leave Types</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage different types of leave and their entitlement rules
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={leaveTypes}
        isLoading={isLoading}
        searchPlaceholder="Search leave types..."
        onSearch={setSearch}
        actionButton={{
          label: 'Add Leave Type',
          onClick: openCreate,
        }}
        emptyMessage="No leave types found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        rowActions={(row) => [
          {
            label: 'Edit',
            onClick: () => openEdit(row),
          },
          ...(row.isDefault
            ? []
            : [
                {
                  label: 'Delete',
                  danger: true,
                  onClick: () => setDeleteTarget(row),
                },
              ]),
        ]}
      />

      {/* Create / Edit Panel */}
      <CreateLeaveTypePanel
        isOpen={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setEditLeaveType(undefined);
        }}
        tenantSlug={tenantSlug}
        editLeaveType={editLeaveType}
      />

      {/* Warning Modal - Editing leave type with existing requests */}
      <Modal
        isOpen={!!warnTarget}
        onClose={() => setWarnTarget(null)}
        title="Warning"
        description={`"${warnTarget?.name}" already has existing leave requests. Editing this may affect current balances. Do you want to continue?`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setWarnTarget(null)}>
              Cancel
            </Button>
            <Button onClick={confirmEdit}>Yes, Continue Editing</Button>
          </div>
        }
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Leave Type"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting..."
              onClick={() => deleteTarget && deleteLeaveType(deleteTarget.id)}
            >
              Delete Leave Type
            </Button>
          </div>
        }
      />
    </>
  );
}
