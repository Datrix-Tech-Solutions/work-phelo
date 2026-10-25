'use client';

import { useMemo, useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { Modal } from '@/components/organisms/shared/Modal';
import { CreateCyclePanel } from '@/components/organisms/hr/appraisal/CreateCyclePanel';
import { useToast } from '@/hooks/useToast';
import { formatDate } from '@/lib/formatters';
import {
  useCancelCycle,
  useCloseCycle,
  useDeleteCycle,
  useGoalCycles,
  useStartCycle,
} from '@/hooks/hr/useGoalAppraisals';
import type { GoalCycle } from '@/types/appraisal';
import { cn } from '@/lib/utils';

type DerivedStatus = 'Upcoming' | 'In Progress' | 'Completed' | 'Expired' | 'Cancelled' | 'Closed';

const STATUS_STYLES: Record<DerivedStatus, { dot: string; text: string }> = {
  'In Progress': { dot: 'bg-blue-500', text: 'text-blue-600' },
  Completed: { dot: 'bg-green-500', text: 'text-green-600' },
  Upcoming: { dot: 'bg-gray-400', text: 'text-gray-500' },
  Expired: { dot: 'bg-red-400', text: 'text-red-500' },
  Cancelled: { dot: 'bg-red-300', text: 'text-red-400' },
  Closed: { dot: 'bg-gray-500', text: 'text-gray-600' },
};

function deriveStatus(cycle: GoalCycle): DerivedStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (cycle.status === 'CANCELLED') return 'Cancelled';
  if (cycle.status === 'CLOSED') return 'Closed';
  if (cycle.endDate < today) return 'Expired';
  return cycle.status === 'UPCOMING' ? 'Upcoming' : 'In Progress';
}

function CycleStatusBadge({ status }: { status: DerivedStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', s.text)}>
      <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
      {status}
    </span>
  );
}

export function AppraisalCyclesList() {
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editCycle, setEditCycle] = useState<GoalCycle | undefined>();
  const [forceCreate, setForceCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GoalCycle | null>(null);
  const [cancelTarget, setCancelTarget] = useState<GoalCycle | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [startTarget, setStartTarget] = useState<GoalCycle | null>(null);
  const [closeTarget, setCloseTarget] = useState<GoalCycle | null>(null);

  const PAGE_SIZE = 10;
  const { cycles: storedCycles } = useGoalCycles();
  const removeCycle = useDeleteCycle();
  const startCycle = useStartCycle();
  const cancelCycle = useCancelCycle();
  const closeCycle = useCloseCycle();
  const allCycles = useMemo(
    () => storedCycles.filter((c) => c.title.toLowerCase().includes(search.trim().toLowerCase())),
    [storedCycles, search],
  );
  const totalPages = Math.max(1, Math.ceil(allCycles.length / PAGE_SIZE));
  const cycles = allCycles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const startedMessage = (skipped: number) =>
    skipped > 0
      ? `Cycle started. ${skipped} ${skipped === 1 ? 'employee has' : 'employees have'} no objectives in this period and was skipped`
      : 'Cycle started';

  const columns: Column<GoalCycle>[] = [
    {
      key: 'title',
      label: 'Cycle Name',
      width: 'minmax(200px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.title}</span>,
    },
    {
      key: 'goals',
      label: 'Goals',
      width: '100px',
      render: (row) => <span className="tabular-nums">{row.goalIds.length}</span>,
    },
    {
      key: 'startDate',
      label: 'Start Date',
      width: '150px',
      render: (row) => <span className="text-gray-700">{formatDate(row.startDate)}</span>,
    },
    {
      key: 'endDate',
      label: 'End Date',
      width: '150px',
      render: (row) => <span className="text-gray-700">{formatDate(row.endDate)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '140px',
      render: (row) => <CycleStatusBadge status={deriveStatus(row)} />,
    },
    {
      key: 'actions',
      label: '',
      width: '220px',
      render: (row) => {
        const status = deriveStatus(row);
        const edit = () => {
          setForceCreate(false);
          setEditCycle(row);
          setPanelOpen(true);
        };

        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {status === 'Upcoming' && (
              <>
                <TableButton variant="green" onClick={() => setStartTarget(row)}>
                  Start
                </TableButton>
                <TableButton variant="gray" onClick={edit}>
                  Edit
                </TableButton>
                <TableButton variant="red" onClick={() => setDeleteTarget(row)}>
                  Delete
                </TableButton>
              </>
            )}

            {status === 'In Progress' && (
              <>
                <TableButton variant="blue" onClick={() => setCloseTarget(row)}>
                  Close
                </TableButton>
                <TableButton variant="gray" onClick={edit}>
                  Edit
                </TableButton>
                <TableButton variant="red" onClick={() => setCancelTarget(row)}>
                  Cancel Cycle
                </TableButton>
              </>
            )}

            {status === 'Expired' && (
              <>
                <TableButton variant="gray" onClick={edit}>
                  Edit
                </TableButton>
                <TableButton variant="red" onClick={() => setDeleteTarget(row)}>
                  Delete
                </TableButton>
              </>
            )}

            {(status === 'Cancelled' || status === 'Closed') && (
              <TableButton
                variant="blue"
                onClick={() => {
                  setForceCreate(true);
                  setEditCycle(row);
                  setPanelOpen(true);
                }}
              >
                Reuse
              </TableButton>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col">
      <DataTable
        columns={columns}
        data={cycles}
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
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <CreateCyclePanel
        isOpen={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setEditCycle(undefined);
          setForceCreate(false);
        }}
        editCycle={editCycle}
        forceCreate={forceCreate}
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
              onClick={() => {
                if (!deleteTarget) return;
                removeCycle.mutate(deleteTarget.id, {
                  onSuccess: () => toast.success('Cycle deleted'),
                });
                setDeleteTarget(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      />

      {/* Cancel modal — In Progress */}
      <Modal
        isOpen={!!cancelTarget}
        onClose={() => {
          setCancelTarget(null);
          setCancelReason('');
        }}
        title="Cancel Cycle"
        description={`Are you sure you want to cancel "${cancelTarget?.title}"? All in-progress appraisals will be stopped.`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCancelTarget(null);
                setCancelReason('');
              }}
            >
              Back
            </Button>
            <Button
              variant="danger"
              disabled={!cancelReason.trim()}
              onClick={() => {
                if (!cancelTarget) return;
                cancelCycle.mutate(
                  { id: cancelTarget.id, reason: cancelReason.trim() },
                  { onSuccess: () => toast.success('Cycle cancelled') },
                );
                setCancelTarget(null);
                setCancelReason('');
              }}
            >
              Cancel Cycle
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-medium text-gray-700">Reason for cancellation</label>
          <textarea
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Enter reason…"
            className="w-full rounded-input border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
          />
        </div>
      </Modal>

      {/* Start modal */}
      <Modal
        isOpen={!!startTarget}
        onClose={() => setStartTarget(null)}
        title="Start Appraisal Cycle"
        description={`Start "${startTarget?.title}"? Everyone its goals cover gets an assessment to rate themselves on.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setStartTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!startTarget) return;
                startCycle.mutate(startTarget.id, {
                  onSuccess: (result) => toast.success(startedMessage(result.skipped)),
                });
                setStartTarget(null);
              }}
            >
              Start Cycle
            </Button>
          </div>
        }
      />

      {/* Close modal — In Progress */}
      <Modal
        isOpen={!!closeTarget}
        onClose={() => setCloseTarget(null)}
        title="Close Appraisal Cycle"
        description={`Close "${closeTarget?.title}"? Objectives added from today on will no longer count for it. Assessments already started can still be completed.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCloseTarget(null)}>
              Back
            </Button>
            <Button
              onClick={() => {
                if (!closeTarget) return;
                closeCycle.mutate(closeTarget.id, {
                  onSuccess: () => toast.success('Cycle closed'),
                });
                setCloseTarget(null);
              }}
            >
              Close Cycle
            </Button>
          </div>
        }
      />
    </div>
  );
}
