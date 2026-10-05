'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { PayrollRun } from '@/types/hr';
import { useApprovePayroll, usePayrollAccountingStatus } from '@/hooks';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { payrollMonthLabel } from '@/lib/payrollUtils';
import { formatPayrollMoney } from '@/lib/payrollDisplay';

interface Props {
  run: PayrollRun | null;
  onClose: () => void;
  onApproved?: () => void;
}

export function ApprovePayrollPanel({ run, onClose, onApproved }: Props) {
  const toast = useToast();
  useTenantConfig();
  const [showConfirm, setShowConfirm] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');
  const [accountingError, setAccountingError] = useState<string | null>(null);
  const { mutate: approve, isPending } = useApprovePayroll();

  const isOpen = run !== null;
  // Accounting decides whether this payroll is posted there; HR just asks, every time the screen opens.
  const accounting = usePayrollAccountingStatus(isOpen);
  const accountingStatus = accounting.data;
  const accountingChecking = accounting.isLoading || accounting.isFetching;
  // Never approve blind: if Accounting could not be asked, or is linked but not ready, wait.
  const accountingBlocked =
    accountingChecking ||
    accounting.isError ||
    accountingStatus?.mode === 'UNKNOWN' ||
    (accountingStatus?.mode === 'ACCOUNTING' && !accountingStatus.ready);
  const periodLabel = run ? payrollMonthLabel(run.month, run.year) : '';
  const money = (value: string | number) =>
    formatPayrollMoney(value, run?.payrollCurrency, run?.payrollCountry);

  const handleClose = () => {
    setShowConfirm(false);
    setApprovalNote('');
    setAccountingError(null);
    onClose();
  };

  const handleConfirm = () => {
    if (!run || !approvalNote.trim()) return;
    setAccountingError(null);
    approve(
      { id: run.id, note: approvalNote.trim() },
      {
        onSuccess: () => {
          toast.success(`${periodLabel} payroll approved`);
          setShowConfirm(false);
          setApprovalNote('');
          onClose();
          onApproved?.();
        },
        onError: (err) => {
          const code = (err as { response?: { data?: { code?: string; message?: string } } })
            ?.response?.data?.code;
          if (
            code === 'ACCOUNTING_POSTING_FAILED' ||
            code === 'ACCOUNTING_NOT_READY' ||
            code === 'ACCOUNTING_STATUS_UNAVAILABLE'
          ) {
            accounting.refetch();
            // Approval did not go through — the run is still pending approval, so the same
            // "Approve Payroll" click safely retries; "Cancel" leaves it pending to try later.
            setAccountingError(
              extractError(err, 'Could not post the payroll accrual to accounting'),
            );
            return;
          }
          toast.error(extractError(err, 'Failed to approve payroll'));
        },
      },
    );
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
            <Button
              disabled={!approvalNote.trim() || accountingBlocked}
              onClick={() => setShowConfirm(true)}
            >
              Approve Payroll
            </Button>
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

            {accountingStatus?.mode === 'ACCOUNTING' && accountingStatus.ready && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
                <p className="text-sm font-medium text-blue-900">Accounting is linked</p>
                <p className="text-sm text-blue-800 mt-0.5">
                  This payroll will be posted to Accounting and settled there.
                </p>
              </div>
            )}
            {accountingStatus?.mode === 'ACCOUNTING' && !accountingStatus.ready && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <p className="text-sm font-medium text-red-800">Accounting is not ready</p>
                <p className="text-sm text-red-700 mt-0.5">
                  Payroll is linked to Accounting, but no account is chosen for{' '}
                  {accountingStatus.missingRoles.join(', ')}. Ask an accountant to choose them in
                  Accounting under Source Types, then check again.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => accounting.refetch()}
                  isLoading={accountingChecking}
                  loadingText="Checking…"
                >
                  Check again
                </Button>
              </div>
            )}
            {(accounting.isError || accountingStatus?.mode === 'UNKNOWN') &&
              !accountingChecking && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <p className="text-sm font-medium text-amber-900">
                    Could not check whether payroll is linked to Accounting
                  </p>
                  <p className="text-sm text-amber-800 mt-0.5">
                    Approval is paused so this payroll is not approved on the wrong footing. Try
                    again.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => accounting.refetch()}
                  >
                    Try again
                  </Button>
                </div>
              )}

            <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
              <p className="text-xs text-gray-500">Approval Note</p>
              <textarea
                rows={4}
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="Explain why this payroll is being approved…"
                className="w-full px-3 py-2.5 text-sm rounded-lg border text-gray-900 border-gray-200 bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 placeholder:text-gray-400 resize-none transition-colors"
              />
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 flex flex-col gap-4">
              <p className="text-sm font-medium text-gray-600">Payroll Summary</p>
              <div className="grid grid-cols-2 gap-y-4 gap-x-0 divide-y divide-gray-200">
                <div className="flex flex-col gap-1 pb-4 pr-4 border-r border-gray-200">
                  <p className="text-xs text-gray-500">Total Gross</p>
                  <p className="text-sm font-semibold text-gray-900">{money(run.totalGross)}</p>
                </div>
                <div className="flex flex-col gap-1 pb-4 pl-4">
                  <p className="text-xs text-gray-500">Total Net Pay</p>
                  <p className="text-sm font-semibold text-emerald-600">{money(run.totalNet)}</p>
                </div>
                <div className="flex flex-col gap-1 pt-4 pr-4 border-r border-gray-200">
                  <p className="text-xs text-gray-500">Total PAYE</p>
                  <p className="text-sm font-semibold text-gray-900">{money(run.totalPAYE)}</p>
                </div>
                <div className="flex flex-col gap-1 pt-4 pl-4">
                  <p className="text-xs text-gray-500">Employer Cost</p>
                  <p className="text-sm font-semibold text-orange-500">
                    {money(run.totalEmployerCost)}
                  </p>
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
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirm(false);
                setAccountingError(null);
              }}
              disabled={isPending}
            >
              {accountingError ? 'Stop' : 'Cancel'}
            </Button>
            <Button
              onClick={handleConfirm}
              isLoading={isPending}
              loadingText={accountingError ? 'Retrying…' : 'Approving…'}
              disabled={!approvalNote.trim()}
            >
              {accountingError ? 'Try Again' : 'Approve Payroll'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 leading-relaxed mt-2">
          You are about to approve payroll for{' '}
          <span className="font-medium text-gray-900">{periodLabel}</span>. Payslips will be
          distributed to all active employees and the payroll will be marked as approved. The total
          employer cost for this period is{' '}
          <span className="font-semibold text-orange-500">
            {run ? money(run.totalEmployerCost) : '—'}
          </span>
          . This action cannot be undone once approved.
        </p>
        {approvalNote.trim() && (
          <p className="text-sm text-gray-500 leading-relaxed mt-3">
            Approval note: <span className="text-gray-700">{approvalNote.trim()}</span>
          </p>
        )}
        {accountingError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <p className="text-sm font-medium text-red-800">Payroll was not approved</p>
            <p className="text-sm text-red-700 mt-0.5">{accountingError}</p>
          </div>
        )}
      </Modal>
    </>
  );
}
