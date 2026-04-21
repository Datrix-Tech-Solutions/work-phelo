'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Modal } from '@/components/organisms/shared/Modal';
import { CreateCyclePanel } from '@/components/organisms/appraisal/CreateCyclePanel';
import { useAppraisalCycles, useStartAppraisalCycle } from '@/hooks/useAppraisals';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { formatDate } from '@/lib/formatters';
import { AppraisalCycle } from '@/types/hr';

interface Props {
  tenantSlug: string;
}

export function AppraisalCyclesList({ tenantSlug }: Props) {
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editCycle, setEditCycle] = useState<AppraisalCycle | undefined>();
  const [startTarget, setStartTarget] = useState<AppraisalCycle | null>(null);

  const { data, isLoading } = useAppraisalCycles({ page, search: search || undefined });
  const cycles: AppraisalCycle[] = data ?? [];
  const totalPages: number = 1;

  const { mutate: startCycle, isPending: isStarting } = useStartAppraisalCycle();

  const columns: Column<AppraisalCycle>[] = [
    {
      key: 'title',
      label: 'Cycle Name',
      width: '2fr',
      render: (row) => (
        <Link
          href={`/${tenantSlug}/hr/hrmanagement/appraisal/cycles/${row.id}`}
          className="font-medium text-gray-900 hover:text-brand hover:underline transition-colors"
        >
          {row.title}
        </Link>
      ),
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
      key: 'isActive',
      label: 'Status',
      width: '120px',
      render: (row) => (
        <Badge
          variant={row.isActive ? 'success' : 'neutral'}
          label={row.isActive ? 'Active' : 'Inactive'}
        />
      ),
    },
  ];

  const rowActions = (row: AppraisalCycle) => {
    const actions = [];
    if (!row.isActive) {
      actions.push({
        label: 'Edit',
        onClick: () => {
          setEditCycle(row);
          setPanelOpen(true);
        },
      });
      actions.push({ label: 'Start Cycle', onClick: () => setStartTarget(row) });
    }
    return actions;
  };

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
        rowActions={rowActions}
        currentPage={page}
        totalPages={totalPages}
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
              isLoading={isStarting}
              loadingText="Starting..."
              onClick={() =>
                startTarget &&
                startCycle(startTarget.id, {
                  onSuccess: () => {
                    toast.success('Cycle started');
                    setStartTarget(null);
                  },
                  onError: (err) => toast.error(extractError(err, 'Failed to start cycle')),
                })
              }
            >
              Start Cycle
            </Button>
          </div>
        }
      />
    </>
  );
}
