'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useRunPayroll, useSubmitPayroll, useUpdatePayrollItem } from '@/hooks';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 3 }, (_, i) => {
  const y = currentYear - 1 + i;
  return { value: String(y), label: String(y) };
});

export interface EmployeeOverride {
  basicSalary?: number;
  totalAllowances?: number;
  transportAmount?: number;
  otherDeductions?: number;
  allowanceItems?: Array<{
    name: string;
    type?: string | null;
    amount: number;
  }>;
  deductionItems?: Array<{
    employeeDeductionId?: string | null;
    name: string;
    amount: number;
  }>;
}

interface Totals {
  gross: number;
  paye: number;
  employerCost: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  totals: Totals;
  overrides: Record<string, EmployeeOverride>;
}

export function RunPayrollPanel({ isOpen, onClose, totals, overrides }: Props) {
  const toast = useToast();
  const { currency } = useTenantConfig();
  const fmt = (n: number) =>
    `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(currentYear));
  const [notes, setNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const { mutateAsync: runPayroll, isPending: isRunning } = useRunPayroll();
  const { mutateAsync: submitPayroll, isPending: isSubmitting } = useSubmitPayroll();
  const { mutateAsync: updateItem, isPending: isUpdating } = useUpdatePayrollItem();
  const isPending = isRunning || isUpdating || isSubmitting;

  const selectedMonthLabel = MONTHS.find((m) => m.value === month)?.label ?? '';

  const handleClose = () => {
    setShowConfirm(false);
    setNotes('');
    onClose();
  };

  const handleConfirm = async () => {
    try {
      const run = await runPayroll({
        month: Number(month),
        year: Number(year),
        notes: notes.trim() || undefined,
      });

      const itemsToUpdate = run.items.filter((item) => overrides[item.employeeId]);
      if (itemsToUpdate.length > 0) {
        for (const item of itemsToUpdate) {
          await updateItem({
            payrollRunId: run.id,
            itemId: item.id,
            data: overrides[item.employeeId],
          });
        }
      }

      await submitPayroll(run.id);

      toast.success(`${selectedMonthLabel} ${year} payroll submitted for approval`);
      setShowConfirm(false);
      onClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to process payroll'));
    }
  };

  return (
    <>
      <SidePanel
        isOpen={isOpen}
        onClose={handleClose}
        title="Run Payroll"
        description="Select the payroll period and review the summary before submitting for approval."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={() => setShowConfirm(true)}>Run Payroll</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <SearchSelect label="Month" options={MONTHS} value={month} onChange={setMonth} />
          <SearchSelect label="Year" options={YEARS} value={year} onChange={setYear} />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              Details <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a short report or notes for this payroll run..."
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-input text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
            />
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 flex flex-col gap-4">
            <p className="text-sm font-medium text-gray-600">Payroll Summary</p>
            <div className="grid grid-cols-3 gap-0 divide-x divide-gray-200">
              <div className="flex flex-col gap-1 pr-4">
                <p className="text-xs text-gray-500">Total Gross</p>
                <p className="text-sm font-semibold text-gray-900">{fmt(totals.gross)}</p>
              </div>
              <div className="flex flex-col gap-1 px-4">
                <p className="text-xs text-gray-500">Total PAYE</p>
                <p className="text-sm font-semibold text-gray-900">{fmt(totals.paye)}</p>
              </div>
              <div className="flex flex-col gap-1 pl-4">
                <p className="text-xs text-gray-500">Employer Cost</p>
                <p className="text-sm font-semibold text-orange-500">{fmt(totals.employerCost)}</p>
              </div>
            </div>
          </div>
        </div>
      </SidePanel>

      <Modal
        isOpen={showConfirm}
        onClose={() => !isPending && setShowConfirm(false)}
        title="Confirm Payroll Run"
        hideClose={isPending}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} isLoading={isPending} loadingText="Processing…">
              Run Payroll
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 leading-relaxed mt-2">
          You are about to run payroll for{' '}
          <span className="font-medium text-gray-900">
            {selectedMonthLabel} {year}
          </span>
          . Payslips will be calculated for all active employees and submitted for approval. The
          total employer cost for this period is{' '}
          <span className="font-semibold text-orange-500">{fmt(totals.employerCost)}</span>. This
          action cannot be undone once submitted.
        </p>
      </Modal>
    </>
  );
}
