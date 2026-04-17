'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Modal } from '@/components/organisms/shared/Modal';
import { CreateLeaveTypePanel } from '@/components/organisms/leave/CreateLeaveTypePanel';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useDeleteLeaveType, leaveKeys } from '@/hooks/useLeave';
import { LeaveType, PaginatedResponse } from '@/types/hr';
import { extractError } from '@/lib/extractError';

interface Props {
  tenantSlug: string;
}

export function LeaveTypesList({ tenantSlug }: Props) {
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editLeaveType, setEditLeaveType] = useState<LeaveType | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<LeaveType | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [...leaveKeys.types(tenantSlug), page],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<LeaveType> | LeaveType[]>('/hr/leave/types', {
        params: { page },
      });
      return res.data;
    },
  });

  const totalPages: number = Array.isArray(data) ? 1 : (data?.totalPages ?? 1);

  const filteredLeaveTypes = useMemo(() => {
    const leaveTypes: LeaveType[] = Array.isArray(data) ? data : (data?.data ?? []);
    if (!search) return leaveTypes;
    const q = search.toLowerCase();
    return leaveTypes.filter((t) => t.name.toLowerCase().includes(q));
  }, [data, search]);

  const { mutate: deleteLeaveType, isPending: isDeleting } = useDeleteLeaveType(tenantSlug);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteLeaveType(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Leave type deleted successfully');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to delete leave type')),
    });
  };

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
      key: 'daysAllowed',
      label: 'Days / Year',
      render: (row) => <span className="font-medium">{row.daysAllowed}</span>,
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
    {
      key: 'applicableTo',
      label: 'Applicable To',
      render: (row) => {
        const types = row.applicableTo ?? [];
        if (types.length === 0) return <span className="text-gray-500 text-sm">All</span>;
        const labels: Record<string, string> = {
          FULL_TIME: 'Full Time',
          PART_TIME: 'Part Time',
          CONTRACT: 'Contract',
          INTERN: 'Intern',
        };
        return (
          <span className="text-gray-700 text-sm">
            {types.map((t) => labels[t] ?? t).join(', ')}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={filteredLeaveTypes}
        isLoading={isLoading}
        searchPlaceholder="Search leave types..."
        onSearch={setSearch}
        // onRowClick={(row) => {
        //   setEditLeaveType(row);
        //   setPanelOpen(true);
        // }}
        actionButton={{
          label: 'Add Leave Type',
          onClick: () => {
            setEditLeaveType(undefined);
            setPanelOpen(true);
          },
        }}
        emptyMessage="No leave types found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        rowActions={(row) => [
          {
            label: 'Edit',
            onClick: () => {
              setEditLeaveType(row);
              setPanelOpen(true);
            },
          },
          ...(row.isDefault
            ? []
            : [{ label: 'Delete', danger: true, onClick: () => setDeleteTarget(row) }]),
        ]}
      />

      <CreateLeaveTypePanel
        isOpen={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setEditLeaveType(undefined);
        }}
        tenantSlug={tenantSlug}
        editLeaveType={editLeaveType}
      />

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
              onClick={handleDelete}
            >
              Delete Leave Type
            </Button>
          </div>
        }
      />
    </>
  );
}
