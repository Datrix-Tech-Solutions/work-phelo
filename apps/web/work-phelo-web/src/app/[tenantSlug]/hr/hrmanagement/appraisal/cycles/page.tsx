// HR MANAGEMEMT APPRAISAL CYCLE ACTION PAGES  //

'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { Modal } from '@/components/organisms/Modal';
import { Button } from '@/components/atoms/Button';
import { CreateCyclePanel } from '@/components/organisms/appraisal/CreateCyclePanel';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { inputClass } from '@/lib/utils';
import { AppraisalCycle, AppraisalStatus } from '@/types/appraisal';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'Upcoming', label: 'Upcoming' },
  { value: 'InProgress', label: 'In Progress' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

export default function AppraisalCyclesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const toast = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editCycle, setEditCycle] = useState<AppraisalCycle | undefined>();
  const [cancelTarget, setCancelTarget] = useState<AppraisalCycle | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['appraisal-cycles', tenantSlug, page, search, statusFilter],
    queryFn: () =>
      api
        .get(`/${tenantSlug}/appraisal/cycles`, {
          params: { page, search: search || undefined, status: statusFilter || undefined },
        })
        .then((r) => r.data),
  });

  const cycles: AppraisalCycle[] = Array.isArray(data) ? data : (data?.data ?? data?.cycles ?? []);
  const totalPages: number = data?.totalPages ?? 1;

  const { mutate: cancelCycle, isPending: isCancelling } = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/${tenantSlug}/appraisal/cycles/${id}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-cycles', tenantSlug] });
      toast.success('Cycle cancelled');
      setCancelTarget(null);
      setCancelReason('');
    },
    onError: (err) => {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'Failed to cancel cycle';
      toast.error(message);
    },
  });

  const columns: Column<AppraisalCycle>[] = [
    {
      key: 'name',
      label: 'Cycle Name',
      width: '2fr',
      render: (row) => (
        <Link
          href={`/${tenantSlug}/hr/hrmanagement/appraisal/cycles/${row.id}`}
          className="font-medium text-gray-900 hover:text-[#0D2244] hover:underline transition-colors"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: 'frequency',
      label: 'Frequency',
      width: '120px',
      render: (row) => <span className="text-gray-600">{row.frequency}</span>,
    },
    {
      key: 'period',
      label: 'Period',
      width: '200px',
      render: (row) => (
        <span className="text-gray-600 text-xs">
          {formatDate(row.startDate)} – {formatDate(row.endDate)}
        </span>
      ),
    },
    {
      key: 'selfAssessmentDeadline',
      label: 'Self Deadline',
      width: '130px',
      render: (row) => (
        <span className="text-gray-600 text-xs">{formatDate(row.selfAssessmentDeadline)}</span>
      ),
    },
    {
      key: 'managerReviewDeadline',
      label: 'Manager Deadline',
      width: '130px',
      render: (row) => (
        <span className="text-gray-600 text-xs">{formatDate(row.managerReviewDeadline)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  const rowActions = (row: AppraisalCycle) => {
    const actions = [];

    if (row.status === 'Upcoming') {
      actions.push({
        label: 'Edit',
        onClick: () => {
          setEditCycle(row);
          setPanelOpen(true);
        },
      });
      actions.push({
        label: 'Cancel Cycle',
        danger: true,
        onClick: () => setCancelTarget(row),
      });
    }

    if (row.status === 'InProgress') {
      actions.push({
        label: 'Extend Deadlines',
        onClick: () => {
          setEditCycle(row);
          setPanelOpen(true);
        },
      });
      actions.push({
        label: 'Cancel Cycle',
        danger: true,
        onClick: () => setCancelTarget(row),
      });
    }

    return actions;
  };

  return (
    <>
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-900">Appraisal Cycles</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Schedule and manage performance review cycles across departments
        </p>
      </div>

      <DataTable
        columns={columns}
        data={cycles}
        isLoading={isLoading}
        emptyMessage="No appraisal cycles yet — create your first one"
        searchPlaceholder="Search cycles..."
        onSearch={setSearch}
        filterOptions={STATUS_OPTIONS}
        onFilter={(v) => setStatusFilter(v as AppraisalStatus | '')}
        actionButton={{
          label: 'New Cycle',
          onClick: () => {
            setEditCycle(undefined);
            setPanelOpen(true);
          },
        }}
        rowActions={rowActions}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      {/* Create / Edit panel */}
      <CreateCyclePanel
        isOpen={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setEditCycle(undefined);
        }}
        tenantSlug={tenantSlug}
        editCycle={editCycle}
      />

      {/* Cancel confirmation modal */}
      <Modal
        isOpen={!!cancelTarget}
        onClose={() => {
          setCancelTarget(null);
          setCancelReason('');
        }}
        title="Cancel Cycle"
        description={`You are about to cancel "${cancelTarget?.name}". All participants will be notified.`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCancelTarget(null);
                setCancelReason('');
              }}
            >
              Go Back
            </Button>
            <Button
              variant="danger"
              isLoading={isCancelling}
              loadingText="Cancelling..."
              onClick={() => {
                if (!cancelReason.trim()) {
                  toast.error('A cancellation reason is required');
                  return;
                }
                cancelCycle({ id: cancelTarget!.id, reason: cancelReason });
              }}
            >
              Cancel Cycle
            </Button>
          </>
        }
      >
        <div className="mt-4 flex flex-col gap-1.5">
          <label className="text-sm font-bold text-gray-900">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Explain why this cycle is being cancelled..."
            rows={3}
            className={inputClass(undefined, 'resize-none')}
          />
        </div>
      </Modal>
    </>
  );
}
