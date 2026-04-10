// HR MANAGEMEMT APPRAISAL CYCLE ACTION PAGES  //

'use client';

import { use, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { CreateCyclePanel } from '@/components/organisms/appraisal/CreateCyclePanel';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useMutation } from '@tanstack/react-query';
import { AppraisalCycle } from '@/types/appraisal';
import { formatDate } from '@/lib/formatters';
import { Badge } from '@/components/atoms/Badge';

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
  const [panelOpen, setPanelOpen] = useState(false);
  const [editCycle, setEditCycle] = useState<AppraisalCycle | undefined>();
  const [startTarget, setStartTarget] = useState<AppraisalCycle | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['appraisal-cycles', tenantSlug, page, search],
    queryFn: () =>
      api
        .get(`/hr/appraisals/cycles`, {
          params: { page, search: search || undefined },
        })
        .then((r) => r.data),
  });

  const cycles: AppraisalCycle[] = Array.isArray(data) ? data : (data?.data ?? data?.cycles ?? []);
  const totalPages: number = data?.totalPages ?? 1;

  const { mutate: startCycle, isPending: isStarting } = useMutation({
    mutationFn: (id: string) => api.post(`/hr/appraisals/cycles/${id}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-cycles', tenantSlug] });
      toast.success('Cycle started');
      setStartTarget(null);
    },
    onError: (err) => {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'Failed to start cycle';
      toast.error(message);
    },
  });

  const columns: Column<AppraisalCycle>[] = [
    {
      key: 'title',
      label: 'Cycle Name',
      width: '2fr',
      render: (row) => (
        <Link
          href={`/${tenantSlug}/hr/hrmanagement/appraisal/cycles/${row.id}`}
          className="font-medium text-gray-900 hover:text-[#0D2244] hover:underline transition-colors"
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
      actions.push({
        label: 'Start Cycle',
        onClick: () => setStartTarget(row),
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

      {/* Start cycle confirmation modal */}
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
              onClick={() => startTarget && startCycle(startTarget.id)}
            >
              Start Cycle
            </Button>
          </div>
        }
      />
    </>
  );
}
