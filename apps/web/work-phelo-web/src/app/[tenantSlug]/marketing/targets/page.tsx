'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { SalesTargetsTable } from '@/components/molecules/marketing/SalesTargetsTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { SalesTargetModal } from '@/components/organisms/marketing/SalesTargetModal';
import {
  useCreateSalesTarget,
  useDeleteSalesTarget,
  useSalesTargets,
  useUpdateSalesTarget,
} from '@/hooks/marketing/useSalesTargets';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { formatDateRange } from '@/lib/formatters';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';
import type { SalesTarget } from '@/types/marketing';

const PAGE_SIZE = 10;

type PeriodFilter = '' | 'current' | 'upcoming' | 'past';

const PERIOD_OPTIONS = [
  { value: 'current', label: 'Current' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
];

function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function matchesPeriod(target: SalesTarget, filter: PeriodFilter): boolean {
  if (!filter) return true;
  const now = today();
  if (filter === 'upcoming') return target.startDate > now;
  if (filter === 'past') return target.endDate < now;
  return target.startDate <= now && target.endDate >= now;
}

export default function SalesTargetsPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('current');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SalesTarget | null>(null);
  const [removing, setRemoving] = useState<SalesTarget | null>(null);

  const canCreate = usePermissionRule('marketing.targets:CREATE');
  const canEdit = usePermissionRule('marketing.targets:EDIT');
  const canDelete = usePermissionRule('marketing.targets:DELETE');

  const { data, isLoading, isError } = useSalesTargets();
  const createTarget = useCreateSalesTarget();
  const updateTarget = useUpdateSalesTarget();
  const deleteTarget = useDeleteSalesTarget();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter(
      (target) =>
        matchesPeriod(target, period) &&
        (!q ||
          (target.userName ?? '').toLowerCase().includes(q) ||
          (target.productName ?? '').toLowerCase().includes(q)),
    );
  }, [data, search, period]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleCreate(payload: Parameters<typeof createTarget.mutate>[0]) {
    createTarget.mutate(payload, {
      onSuccess: () => {
        toast.success('Target created');
        closeModal();
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to create target')),
    });
  }

  function handleUpdate(id: string, amount: number) {
    updateTarget.mutate(
      { id, amount },
      {
        onSuccess: () => {
          toast.success('Target updated');
          closeModal();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to update target')),
      },
    );
  }

  function handleRemove() {
    if (!removing) return;
    deleteTarget.mutate(removing.id, {
      onSuccess: () => {
        toast.success('Target removed');
        setRemoving(null);
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to remove target')),
    });
  }

  if (isError) {
    return (
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <p className="text-sm text-red-500 text-center py-8">Failed to load targets.</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <SalesTargetsTable
          data={pageRows}
          isLoading={isLoading}
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          extraFilters={
            <SearchSelect
              size="sm"
              placeholder="Period"
              allLabel="All periods"
              options={PERIOD_OPTIONS}
              value={period}
              onChange={(value) => {
                setPeriod(value as PeriodFilter);
                setPage(1);
              }}
              showAllOption
            />
          }
          currentPage={Math.min(page, totalPages)}
          totalPages={totalPages}
          onPageChange={setPage}
          onAdd={canCreate ? () => setModalOpen(true) : undefined}
          onEdit={
            canEdit
              ? (target) => {
                  setEditing(target);
                  setModalOpen(true);
                }
              : undefined
          }
          onRemove={canDelete ? setRemoving : undefined}
        />
      </div>

      {modalOpen && (
        <SalesTargetModal
          key={editing?.id ?? 'new'}
          editing={editing}
          isSubmitting={createTarget.isPending || updateTarget.isPending}
          onClose={closeModal}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />
      )}

      <Modal
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove Target"
        description={
          removing
            ? `Remove ${removing.userName ?? 'this rep'}'s target for ${formatDateRange(removing.startDate, removing.endDate)}? This cannot be undone.`
            : ''
        }
        width="max-w-sm"
        height="max-h-fit"
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Keep
            </Button>
            <Button variant="danger" onClick={handleRemove} isLoading={deleteTarget.isPending}>
              Remove Target
            </Button>
          </>
        }
      />
    </>
  );
}
