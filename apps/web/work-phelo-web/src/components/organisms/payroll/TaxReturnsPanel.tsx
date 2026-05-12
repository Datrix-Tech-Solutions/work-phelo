'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { PayrollItem } from '@/types/hr';
import { payrollMonthLabel } from '@/lib/payrollUtils';

interface TaxReturnsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  payslips: PayrollItem[];
}

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
const YEARS = Array.from({ length: 6 }, (_, i) => {
  const y = currentYear - 5 + i + 1;
  return { value: String(y), label: String(y) };
}).reverse();

function ghs(value: string | number) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return `GHS ${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TaxReturnsPanel({ isOpen, onClose, payslips }: TaxReturnsPanelProps) {
  const [startMonth, setStartMonth] = useState('1');
  const [startYear, setStartYear] = useState(String(currentYear));
  const [endMonth, setEndMonth] = useState(String(new Date().getMonth() + 1));
  const [endYear, setEndYear] = useState(String(currentYear));

  const startVal = Number(startYear) * 12 + Number(startMonth);
  const endVal = Number(endYear) * 12 + Number(endMonth);
  const rangeValid = endVal >= startVal;

  const filtered = rangeValid
    ? payslips.filter((p) => {
        if (!p.payrollRun) return false;
        const val = p.payrollRun.year * 12 + p.payrollRun.month;
        return val >= startVal && val <= endVal;
      })
    : [];

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Tax Returns"
      description="Select a date range to view payslips for that period."
      width="w-[520px]"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled
            className="flex items-center gap-2 bg-brand hover:bg-brand-hover"
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
      }
    >
      {/* Date range pickers */}
      <div className="flex flex-col gap-4 shrink-0">
        <div className="grid grid-cols-2 gap-3">
          <SearchSelect
            label="Start Month"
            options={MONTHS}
            value={startMonth}
            onChange={setStartMonth}
          />
          <SearchSelect
            label="Start Year"
            options={YEARS}
            value={startYear}
            onChange={setStartYear}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SearchSelect
            label="End Month"
            options={MONTHS}
            value={endMonth}
            onChange={setEndMonth}
          />
          <SearchSelect label="End Year" options={YEARS} value={endYear} onChange={setEndYear} />
        </div>

        {!rangeValid && (
          <p className="text-xs text-red-500">End date must be on or after the start date.</p>
        )}
      </div>

      <div className="h-px bg-gray-100 shrink-0" />

      {/* Results */}
      <div className="flex flex-col gap-3">
        {!rangeValid ? null : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No payslips found for the selected range.
          </p>
        ) : (
          <>
            {filtered.map((p) => {
              const run = p.payrollRun!;
              const label = payrollMonthLabel(run.month, run.year);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-4 py-4 border border-gray-200 rounded-card bg-white"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Gross: {ghs(p.grossSalary)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">PAYE: {ghs(p.payeTax)}</p>
                      <p className="text-sm font-bold text-gray-900">{ghs(p.netSalary)}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Totals */}
            <div className="flex items-center justify-between px-4 py-4 rounded-card bg-gray-50 border border-gray-200">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Total ({filtered.length} months)
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Gross: {ghs(filtered.reduce((s, p) => s + parseFloat(p.grossSalary), 0))}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">
                  PAYE: {ghs(filtered.reduce((s, p) => s + parseFloat(p.payeTax), 0))}
                </p>
                <p className="text-sm font-bold text-emerald-600">
                  {ghs(filtered.reduce((s, p) => s + parseFloat(p.netSalary), 0))}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </SidePanel>
  );
}
