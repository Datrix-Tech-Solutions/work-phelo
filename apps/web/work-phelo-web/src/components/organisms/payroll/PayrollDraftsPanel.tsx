'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { usePayrollRuns, useSubmitPayroll } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { PayrollRun } from '@/types/hr';

const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function fmt(value: string | number) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function DraftItem({ run, onSubmitted }: { run: PayrollRun; onSubmitted: () => void }) {
  const toast = useToast();
  const { mutateAsync: submitPayroll, isPending } = useSubmitPayroll();

  const handleSubmit = async () => {
    try {
      await submitPayroll(run.id);
      toast.success(`${MONTH_NAMES[run.month]} ${run.year} payroll submitted for approval`);
      onSubmitted();
    } catch (err) {
      toast.error(extractError(err, 'Failed to submit payroll'));
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-100 bg-gray-50">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-gray-900">
          {MONTH_NAMES[run.month]} {run.year}
        </p>
        <p className="text-xs text-gray-500">Total Gross: {fmt(run.totalGross)}</p>
        {run.notes && (
          <p className="text-xs text-gray-400 italic truncate max-w-[220px]">{run.notes}</p>
        )}
      </div>
      <Button size="sm" onClick={handleSubmit} isLoading={isPending} loadingText="Submitting…">
        Submit
      </Button>
    </div>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function PayrollDraftsPanel({ isOpen, onClose }: Props) {
  const { data: runs = [], isLoading } = usePayrollRuns();
  const drafts = runs.filter((r) => r.status === 'DRAFT');

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Draft Payrolls"
      description="Payroll runs that haven't been submitted for approval yet."
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-400">Loading drafts…</p>
        </div>
      ) : drafts.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-400">No draft payrolls found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {drafts.map((run) => (
            <DraftItem key={run.id} run={run} onSubmitted={onClose} />
          ))}
        </div>
      )}
    </SidePanel>
  );
}
