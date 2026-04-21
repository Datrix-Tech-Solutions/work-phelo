'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { DetailField } from '@/components/molecules/shared/DetailField';
import { useMyPayslips } from '@/hooks/usePayroll';
import { useMyProfile } from '@/hooks/hr/useEmployees';
import { calculatePayroll, AllowanceItem } from '@/lib/payrollCalculations';

const MONTH_NAMES = [
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

const STATUS_VARIANT = {
  DRAFT: 'warning',
  APPROVED: 'info',
  PAID: 'success',
} as const;

interface Payslip {
  id: string;
  grossPay?: number | null;
  netPay?: number | null;
  payrollRun?: { year: number; month: number; status?: string };
}

function payslipLabel(p: Payslip) {
  if (!p.payrollRun) return '—';
  return `${MONTH_NAMES[p.payrollRun.month - 1]} ${p.payrollRun.year}`;
}

export function MyPayslipTab() {
  const { data: payslipsRaw } = useMyPayslips();
  const { data: employee } = useMyProfile();

  const payslips: Payslip[] = Array.isArray(payslipsRaw) ? payslipsRaw : [];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = payslips[selectedIdx] ?? null;

  const netSalary = Number(selected?.netPay) || 0;
  const grossSalary = Number(selected?.grossPay) || 0;
  const runStatus = selected?.payrollRun?.status ?? '';

  // Derive detailed breakdown from basic salary if available
  const breakdown = useMemo(() => {
    const basic = Number(employee?.basicSalary) || 0;
    if (!basic || !grossSalary) return null;
    const allowanceAmount = Math.max(0, grossSalary - basic);
    const allowances: AllowanceItem[] =
      allowanceAmount > 0 ? [{ name: 'Allowances', amount: allowanceAmount }] : [];
    return calculatePayroll({
      basicSalary: basic,
      allowances,
      country: 'GH',
    });
  }, [employee?.basicSalary, grossSalary]);

  if (payslips.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">No payslips available yet</p>
      </div>
    );
  }

  const statusVariant = STATUS_VARIANT[runStatus as keyof typeof STATUS_VARIANT] ?? 'neutral';

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      {/* Period selector */}
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-base font-semibold text-gray-900">My Payslip</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedIdx((i) => Math.max(0, i - 1))}
            disabled={selectedIdx === 0}
            className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-4 py-1.5 bg-white border border-gray-200 rounded-input text-sm font-medium text-gray-900 min-w-36 text-center">
            {selected ? payslipLabel(selected) : '—'}
          </span>

          <button
            onClick={() => setSelectedIdx((i) => Math.min(payslips.length - 1, i + 1))}
            disabled={selectedIdx === payslips.length - 1}
            className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {runStatus && <Badge variant={statusVariant} label={runStatus} />}

          <Button variant="outline" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
      </div>

      {/* Net salary hero */}
      <div
        className="rounded-card px-8 py-6 shrink-0"
        style={{ background: 'linear-gradient(135deg, #0D1F44 0%, #1E3A8A 100%)' }}
      >
        <p className="text-sm text-blue-300 mb-1">Net Salary</p>
        <p className="text-5xl font-bold text-white tabular-nums">
          GHS {netSalary.toLocaleString()}
        </p>
        <p className="text-sm text-blue-300 mt-2">
          {selected ? payslipLabel(selected) : '—'} · {runStatus || '—'}
        </p>
      </div>

      {/* Breakdown — detailed if basic salary available, summary otherwise */}
      {breakdown ? (
        <>
          <SectionCard title="Payroll Breakdown">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
              <DetailField
                label="Basic Salary"
                value={`GHS ${breakdown.basicSalary.toLocaleString()}`}
              />
              <DetailField
                label="Allowances"
                value={`GHS ${breakdown.totalAllowances.toLocaleString()}`}
              />
              <DetailField
                label="Gross Salary"
                value={`GHS ${breakdown.grossSalary.toLocaleString()}`}
              />
              <DetailField
                label="Employee SSNIT (5.5%)"
                value={`GHS ${breakdown.employeeStatutoryContrib.toLocaleString()}`}
              />
              <DetailField
                label="Taxable Income"
                value={`GHS ${breakdown.taxableIncome.toLocaleString()}`}
              />
              <DetailField label="PAYE Tax" value={`GHS ${breakdown.paye.toLocaleString()}`} />
              <DetailField
                label="Net Salary"
                value={`GHS ${breakdown.netSalary.toLocaleString()}`}
              />
            </div>
          </SectionCard>

          <SectionCard title="Employer Contributions">
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              <DetailField
                label="Employer SSNIT (13%)"
                value={`GHS ${breakdown.employerStatutoryContrib.toLocaleString()}`}
              />
              <DetailField
                label="Total Employer Cost"
                value={`GHS ${breakdown.totalEmployerCost.toLocaleString()}`}
              />
            </div>
          </SectionCard>
        </>
      ) : (
        <SectionCard title="Payroll Breakdown">
          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            <DetailField label="Gross Salary" value={`GHS ${grossSalary.toLocaleString()}`} />
            <DetailField label="Net Salary" value={`GHS ${netSalary.toLocaleString()}`} />
          </div>
        </SectionCard>
      )}
    </div>
  );
}
