'use client';

import { useCallback, useMemo, useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { Badge } from '@/components/atoms/Badge';
import {
  ClosePeriodAction,
  ClosePeriodModal,
} from '@/components/organisms/accounting/modals/ClosePeriodModal';
import { FiscalPeriod } from '@/types/accounting';
import {
  useCloseFiscalPeriod,
  useLockFiscalPeriod,
  useOpenFiscalPeriod,
  useSoftCloseFiscalPeriod,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { FISCAL_STATUS_LABEL, FISCAL_STATUS_VARIANT } from '@/lib/accounting/fiscalPeriodStatus';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function buildColumns(
  onReopen: (row: FiscalPeriod) => void,
  onCloseRequest: (row: FiscalPeriod, action: ClosePeriodAction) => void,
  onLockRequest: (row: FiscalPeriod) => void,
): Column<FiscalPeriod>[] {
  return [
    {
      key: 'name',
      label: 'Period',
      width: 'minmax(150px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'startDate',
      label: 'Start Date',
      width: '160px',
      render: (row) => <span className="text-gray-700 text-sm">{fmtDate(row.startDate)}</span>,
    },
    {
      key: 'endDate',
      label: 'End Date',
      width: '160px',
      render: (row) => <span className="text-gray-700 text-sm">{fmtDate(row.endDate)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '150px',
      render: (row) => (
        <Badge
          label={FISCAL_STATUS_LABEL[row.status]}
          variant={FISCAL_STATUS_VARIANT[row.status]}
        />
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '240px',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {row.status === 'OPEN' && (
            <>
              <TableButton variant="blue" onClick={() => onCloseRequest(row, 'soft-close')}>
                Soft Close
              </TableButton>
              <TableButton variant="red" onClick={() => onCloseRequest(row, 'close')}>
                Close
              </TableButton>
            </>
          )}
          {row.status === 'SOFT_CLOSED' && (
            <>
              <TableButton variant="red" onClick={() => onCloseRequest(row, 'close')}>
                Close
              </TableButton>
              <TableButton variant="green" onClick={() => onReopen(row)}>
                Reopen
              </TableButton>
            </>
          )}
          {row.status === 'CLOSED' && (
            <>
              <TableButton variant="green" onClick={() => onReopen(row)}>
                Reopen
              </TableButton>
              <TableButton variant="gray" onClick={() => onLockRequest(row)}>
                Lock
              </TableButton>
            </>
          )}
        </div>
      ),
    },
  ];
}

/** The periods of one fiscal year, with the close / soft close / reopen / lock actions. */
export function FiscalPeriodsTable({
  periods,
  isLoading = false,
}: {
  periods: FiscalPeriod[];
  isLoading?: boolean;
}) {
  const [closeTarget, setCloseTarget] = useState<{
    period: FiscalPeriod;
    action: ClosePeriodAction;
  } | null>(null);
  const [lockTarget, setLockTarget] = useState<FiscalPeriod | null>(null);

  const toast = useToast();
  const openMutation = useOpenFiscalPeriod();
  const softCloseMutation = useSoftCloseFiscalPeriod();
  const closeMutation = useCloseFiscalPeriod();
  const lockMutation = useLockFiscalPeriod();

  const reopen = useCallback(
    async (row: FiscalPeriod) => {
      try {
        await openMutation.mutateAsync(row.id);
      } catch (err) {
        toast.error(extractError(err, 'Failed to reopen period'));
      }
    },
    [openMutation, toast],
  );

  async function confirmClose({
    period,
    action,
  }: {
    period: FiscalPeriod;
    action: ClosePeriodAction;
  }) {
    const soft = action === 'soft-close';
    try {
      await (soft ? softCloseMutation : closeMutation).mutateAsync(period.id);
      setCloseTarget(null);
    } catch (err) {
      toast.error(
        extractError(err, soft ? 'Failed to soft close period' : 'Failed to close period'),
      );
    }
  }

  async function confirmLock(row: FiscalPeriod) {
    try {
      await lockMutation.mutateAsync(row.id);
      setLockTarget(null);
    } catch (err) {
      toast.error(extractError(err, 'Failed to lock period'));
    }
  }

  const columns = useMemo(
    () =>
      buildColumns(reopen, (period, action) => setCloseTarget({ period, action }), setLockTarget),
    [reopen],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={periods}
        isLoading={isLoading}
        emptyMessage="This fiscal year has no periods"
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
      />

      <ClosePeriodModal
        period={closeTarget?.period ?? null}
        action={closeTarget?.action ?? 'close'}
        isSubmitting={closeMutation.isPending || softCloseMutation.isPending}
        onClose={() => setCloseTarget(null)}
        onConfirm={() => closeTarget && confirmClose(closeTarget)}
      />

      <Modal
        isOpen={!!lockTarget}
        onClose={() => setLockTarget(null)}
        title="Lock Period"
        description={`Lock "${lockTarget?.name}"? Locked periods are permanently immutable and can never be reopened.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setLockTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={lockMutation.isPending}
              loadingText="Locking…"
              onClick={() => lockTarget && confirmLock(lockTarget)}
            >
              Lock
            </Button>
          </div>
        }
      />
    </>
  );
}
