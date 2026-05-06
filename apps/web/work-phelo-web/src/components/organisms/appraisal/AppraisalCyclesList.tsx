'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { CreateCyclePanel } from '@/components/organisms/appraisal/CreateCyclePanel';
import {
  useAppraisalCycles,
  useDeleteAppraisalCycle,
  useStartAppraisalCycle,
  useSeedCycleFromTemplate,
  useCancelAppraisalCycle,
  useCycleAppraisals,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { formatDate } from '@/lib/formatters';
import { AppraisalCycle } from '@/types/hr';
import { cn } from '@/lib/utils';

interface Props {
  tenantSlug: string;
}

type DerivedStatus = 'Upcoming' | 'In Progress' | 'Completed' | 'Expired' | 'Cancelled';

const STATUS_STYLES: Record<DerivedStatus, { dot: string; text: string }> = {
  'In Progress': { dot: 'bg-blue-500', text: 'text-blue-600' },
  Completed: { dot: 'bg-green-500', text: 'text-green-600' },
  Upcoming: { dot: 'bg-gray-400', text: 'text-gray-500' },
  Expired: { dot: 'bg-red-400', text: 'text-red-500' },
  Cancelled: { dot: 'bg-red-300', text: 'text-red-400' },
};

function useDerivedCycleStatus(cycle: AppraisalCycle): DerivedStatus {
  const { data: raw } = useCycleAppraisals(cycle.id);

  const appraisals: { selfStatus?: string; managerStatus?: string }[] = useMemo(() => {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).data))
      return (raw as { data: { selfStatus?: string; managerStatus?: string }[] }).data;
    return [];
  }, [raw]);

  const total = appraisals.length;
  const selfCompleted = appraisals.filter((a) => a.selfStatus === 'SUBMITTED').length;
  const managerCompleted = appraisals.filter((a) => a.managerStatus === 'SUBMITTED').length;
  const rate = total > 0 ? Math.round(((selfCompleted + managerCompleted) / (total * 2)) * 100) : 0;

  if (cycle.status === 'CANCELLED') return 'Cancelled';
  if (rate >= 100) return 'Completed';
  const today = new Date().toISOString().slice(0, 10);
  if (cycle.endDate < today) return 'Expired';
  if (cycle.status === 'UPCOMING') return 'Upcoming';
  return 'In Progress';
}

function CycleStatusBadge({ cycle }: { cycle: AppraisalCycle }) {
  const status = useDerivedCycleStatus(cycle);
  const s = STATUS_STYLES[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', s.text)}>
      <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
      {status}
    </span>
  );
}

interface CycleActionsProps {
  cycle: AppraisalCycle;
  onEdit: (cycle: AppraisalCycle) => void;
  onDelete: (cycle: AppraisalCycle) => void;
  onStart: (cycle: AppraisalCycle) => void;
  onCancel: (cycle: AppraisalCycle) => void;
}

function CycleActions({ cycle, onEdit, onDelete, onStart, onCancel }: CycleActionsProps) {
  const status = useDerivedCycleStatus(cycle);

  return (
    <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
      {status === 'Upcoming' && (
        <>
          <button
            onClick={() => onStart(cycle)}
            className="text-sm font-semibold text-brand hover:text-brand/80 transition-colors"
          >
            Start
          </button>
          <button
            onClick={() => onEdit(cycle)}
            className="text-sm font-semibold text-gray-800 hover:text-brand transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(cycle)}
            className="text-sm font-semibold text-red-500 hover:text-red-700 transition-colors"
          >
            Delete
          </button>
        </>
      )}

      {status === 'In Progress' && (
        <>
          <button
            onClick={() => onEdit(cycle)}
            className="text-sm font-semibold text-gray-800 hover:text-brand transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onCancel(cycle)}
            className="text-sm font-semibold text-red-500 hover:text-red-700 transition-colors"
          >
            Cancel Cycle
          </button>
        </>
      )}

      {status === 'Expired' && (
        <>
          <button
            onClick={() => onEdit(cycle)}
            className="text-sm font-semibold text-gray-800 hover:text-brand transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(cycle)}
            className="text-sm font-semibold text-red-500 hover:text-red-700 transition-colors"
          >
            Delete
          </button>
        </>
      )}
    </div>
  );
}

export function AppraisalCyclesList({ tenantSlug }: Props) {
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editCycle, setEditCycle] = useState<AppraisalCycle | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<AppraisalCycle | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AppraisalCycle | null>(null);
  const [startTarget, setStartTarget] = useState<AppraisalCycle | null>(null);

  const { data, isLoading } = useAppraisalCycles({ page, search: search || undefined });
  const cycles: AppraisalCycle[] = data ?? [];

  const { mutate: startCycle, isPending: isStarting } = useStartAppraisalCycle();
  const { mutate: seedKpis, isPending: isSeeding } = useSeedCycleFromTemplate();
  const { mutate: deleteCycle, isPending: isDeleting } = useDeleteAppraisalCycle();
  const { mutate: cancelCycle, isPending: isCancelling } = useCancelAppraisalCycle();

  const handleStart = (cycle: AppraisalCycle) => {
    const doStart = () =>
      startCycle(cycle.id, {
        onSuccess: () => {
          toast.success('Cycle started');
          setStartTarget(null);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to start cycle')),
      });

    if (cycle.templateId) {
      seedKpis(cycle.id, {
        onSuccess: doStart,
        onError: (err) => toast.error(extractError(err, 'Failed to seed KPIs from template')),
      });
    } else {
      doStart();
    }
  };

  const columns: Column<AppraisalCycle>[] = [
    {
      key: 'title',
      label: 'Cycle Name',
      render: (row) => (
        <Link
          href={`/${tenantSlug}/hr/hrmanagement/appraisal/cycles/${row.id}`}
          className="font-medium text-gray-900 hover:text-brand hover:underline transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {row.title}
        </Link>
      ),
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
      key: 'status',
      label: 'Status',
      width: '140px',
      render: (row) => <CycleStatusBadge cycle={row} />,
    },
    {
      key: 'actions',
      label: '',
      width: '180px',
      render: (row) => (
        <CycleActions
          cycle={row}
          onEdit={(c) => {
            setEditCycle(c);
            setPanelOpen(true);
          }}
          onDelete={setDeleteTarget}
          onStart={setStartTarget}
          onCancel={setCancelTarget}
        />
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={cycles}
        isLoading={isLoading}
        emptyMessage="No appraisal cycles yet — create your first one"
        searchPlaceholder="Search cycles..."
        onSearch={setSearch}
        actionButton={{
          label: 'New Cycle',
          onClick: () => {
            setEditCycle(undefined);
            setPanelOpen(true);
          },
        }}
        currentPage={page}
        totalPages={1}
        onPageChange={setPage}
      />

      <CreateCyclePanel
        isOpen={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setEditCycle(undefined);
        }}
        editCycle={editCycle}
      />

      {/* Delete modal — Upcoming / Expired only */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Cycle"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting..."
              onClick={() =>
                deleteTarget &&
                deleteCycle(deleteTarget.id, {
                  onSuccess: () => {
                    toast.success('Cycle deleted');
                    setDeleteTarget(null);
                  },
                  onError: (err) => toast.error(extractError(err, 'Failed to delete cycle')),
                })
              }
            >
              Delete
            </Button>
          </>
        }
      />

      {/* Cancel modal — In Progress */}
      <Modal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel Cycle"
        description={`Are you sure you want to cancel "${cancelTarget?.title}"? All in-progress appraisals will be stopped.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>
              Back
            </Button>
            <Button
              variant="danger"
              isLoading={isCancelling}
              loadingText="Cancelling..."
              onClick={() =>
                cancelTarget &&
                cancelCycle(
                  { id: cancelTarget.id },
                  {
                    onSuccess: () => {
                      toast.success('Cycle cancelled');
                      setCancelTarget(null);
                    },
                    onError: (err) => toast.error(extractError(err, 'Failed to cancel cycle')),
                  },
                )
              }
            >
              Cancel Cycle
            </Button>
          </>
        }
      />

      {/* Start modal */}
      <Modal
        isOpen={!!startTarget}
        onClose={() => setStartTarget(null)}
        title="Start Appraisal Cycle"
        description={`Start "${startTarget?.title}"? This will generate appraisal records for all employees.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setStartTarget(null)}>
              Cancel
            </Button>
            <Button
              isLoading={isSeeding || isStarting}
              loadingText={isSeeding ? 'Seeding KPIs...' : 'Starting...'}
              onClick={() => startTarget && handleStart(startTarget)}
            >
              Start Cycle
            </Button>
          </div>
        }
      />
    </>
  );
}
