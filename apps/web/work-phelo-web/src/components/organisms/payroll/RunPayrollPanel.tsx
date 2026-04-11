'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useRunPayroll } from '@/hooks/usePayroll';
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function RunPayrollPanel({ isOpen, onClose }: Props) {
  const toast = useToast();
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(currentYear));
  const [description, setDescription] = useState('');

  const { mutate, isPending } = useRunPayroll();

  const handleSubmit = () => {
    mutate(
      { month: Number(month), year: Number(year), description: description.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Payroll run started');
          setDescription('');
          onClose();
        },
        onError: (err) => toast.error(extractError(err, 'Failed to run payroll')),
      },
    );
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Run Payroll"
      description="Generate payroll for the selected period. Salaries will be calculated for all active employees."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Processing…" onClick={handleSubmit}>
            Run Payroll
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <SearchSelect label="Month" options={MONTHS} value={month} onChange={setMonth} />
        <SearchSelect label="Year" options={YEARS} value={year} onChange={setYear} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. April 2026 payroll"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-input text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>

        <div className="p-3 bg-amber-50 border border-amber-100 rounded-input">
          <p className="text-xs text-amber-700 leading-relaxed">
            Running payroll will generate payslips for all active employees based on their current
            salary details. You can approve and mark as paid once reviewed.
          </p>
        </div>
      </div>
    </SidePanel>
  );
}
