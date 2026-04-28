'use client';

import { useState } from 'react';
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
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { formatDate } from '@/lib/formatters';
import { AppraisalCycle } from '@/types/hr';
import { cn } from '@/lib/utils';

interface Props {
  tenantSlug: string;
}

type CycleStatus = 'In Progress' | 'Completed' | 'Upcoming' | 'Expired';

function deriveCycleStatus(cycle: AppraisalCycle): CycleStatus {
  if ((cycle.completionRate ?? 0) >= 100) return 'Completed';
  const today = new Date().toISOString().slice(0, 10);
  if (cycle.endDate < today) return 'Expired';
  if ((cycle._count?.appraisals ?? 0) > 0) return 'In Progress';
  if (cycle.startDate > today) return 'Upcoming';
  return 'In Progress';
}

const STATUS_STYLES: Record<CycleStatus, { dot: string; text: string }> = {
  'In Progress': { dot: 'bg-blue-500', text: 'text-blue-600' },
  Completed: { dot: 'bg-green-500', text: 'text-green-600' },
  Upcoming: { dot: 'bg-gray-400', text: 'text-gray-500' },
  Expired: { dot: 'bg-red-400', text: 'text-red-500' },
};

function CycleStatusBadge({ cycle }: { cycle: AppraisalCycle }) {
  const status = deriveCycleStatus(cycle);
  const s = STATUS_STYLES[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', s.text)}>
      <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
      {status}
    </span>
  );
}

export function AppraisalCyclesList({ tenantSlug }: Props) {
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editCycle, setEditCycle] = useState<AppraisalCycle | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<AppraisalCycle | null>(null);
  const [startTarget, setStartTarget] = useState<AppraisalCycle | null>(null);

  const { data, isLoading } = useAppraisalCycles({ page, search: search || undefined });
  const cycles: AppraisalCycle[] = data ?? [];

  const { mutate: startCycle, isPending: isStarting } = useStartAppraisalCycle();
  const { mutate: seedKpis, isPending: isSeeding } = useSeedCycleFromTemplate();
  const { mutate: deleteCycle, isPending: isDeleting } = useDeleteAppraisalCycle();

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
      width: '120px',
      render: (row) => (
        <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
          {(row._count?.appraisals ?? 0) === 0 && (
            <button
              onClick={() => setStartTarget(row)}
              className="text-sm font-semibold text-brand hover:text-brand/80 transition-colors"
            >
              Start
            </button>
          )}
          <button
            onClick={() => {
              setEditCycle(row);
              setPanelOpen(true);
            }}
            className="text-sm font-semibold text-gray-800 hover:text-brand transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="text-sm font-semibold text-red-500 hover:text-red-700 transition-colors"
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
