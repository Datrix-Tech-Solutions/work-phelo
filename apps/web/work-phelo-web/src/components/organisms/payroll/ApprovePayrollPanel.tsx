'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { PayrollRun } from '@/types/hr';
import { useApprovePayroll } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { payrollMonthLabel } from '@/lib/payrollUtils';

function fmt(value: string | number) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface Props {
  run: PayrollRun | null;
  onClose: () => void;
}

export function ApprovePayrollPanel({ run, onClose }: Props) {
  const toast = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  const { mutate: approve, isPending } = useApprovePayroll();

  const isOpen = run !== null;
  const periodLabel = run ? payrollMonthLabel(run.month, run.year) : '';

  const handleClose = () => {
    setShowConfirm(false);
    onClose();
  };

  const handleConfirm = () => {
    if (!run) return;
    approve(run.id, {
      onSuccess: () => {
        toast.success(`${periodLabel} payroll approved`);
        setShowConfirm(false);
        onClose();
      },
      onError: (err) => toast.error(extractError(err, 'Failed to approve payroll')),
    });
  };

  return (
    <>
      <SidePanel
        isOpen={isOpen}
        onClose={handleClose}
        title="Approve Payroll"
        description="Review the payroll summary before approving for payment."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={() => setShowConfirm(true)}>Approve Payroll</Button>
          </div>
        }
      >
        {run && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-gray-500">Payroll Period</p>
              <p className="text-sm font-semibold text-gray-900">{periodLabel}</p>
            </div>

            {run.notes && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-gray-500">Details</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 border border-gray-100 rounded-input px-3 py-2.5">
                  {run.notes}
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 flex flex-col gap-4">
              <p className="text-sm font-medium text-gray-600">Payroll Summary</p>
              <div className="grid grid-cols-3 gap-0 divide-x divide-gray-200">
                <div className="flex flex-col gap-1 pr-4">
                  <p className="text-xs text-gray-500">Total Gross</p>
                  <p className="text-sm font-semibold text-gray-900">{fmt(run.totalGross)}</p>
                </div>
                <div className="flex flex-col gap-1 px-4">
                  <p className="text-xs text-gray-500">Total PAYE</p>
                  <p className="text-sm font-semibold text-gray-900">{fmt(run.totalPAYE)}</p>
                </div>
                <div className="flex flex-col gap-1 pl-4">
                  <p className="text-xs text-gray-500">Employer Cost</p>
                  <p className="text-sm font-semibold text-orange-500">—</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </SidePanel>

      <Modal
        isOpen={showConfirm}
        onClose={() => !isPending && setShowConfirm(false)}
        title="Confirm Payroll Approval"
        hideClose={isPending}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} isLoading={isPending} loadingText="Approving…">
              Approve Payroll
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 leading-relaxed mt-2">
          You are about to approve payroll for{' '}
          <span className="font-medium text-gray-900">{periodLabel}</span>. Payslips will be
          distributed to all active employees and the payroll will be marked as approved. The total
          employer cost for this period is{' '}
          <span className="font-semibold text-orange-500">{run ? fmt(run.totalGross) : '—'}</span>.
          This action cannot be undone once approved.
        </p>
      </Modal>
    </>
  );
}
