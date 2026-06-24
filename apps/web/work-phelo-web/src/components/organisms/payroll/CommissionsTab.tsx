'use client';

import { FileText, TrendingUp } from 'lucide-react';
import { MetricCard } from '@/components/molecules/shared/MetricCard';
import { DataTable, type Column } from '../shared/DataTable';
import { usePayrollRuns } from '@/hooks';
import { payrollMonthLabel } from '@/lib/payrollUtils';
import { formatPayrollMoney } from '@/lib/payrollDisplay';
import type { PayrollRun } from '@/types/hr';

export function CommissionsTab() {
  const { data: runs = [], isLoading } = usePayrollRuns();
  const draftRuns = runs
    .filter((run) => run.status === 'DRAFT')
    .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));

  const columns: Column<PayrollRun>[] = [
    {
      key: 'period',
      label: 'Draft Payroll',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-brand" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{payrollMonthLabel(row.month, row.year)}</p>
            <p className="text-xs text-gray-500">{row.notes || 'Draft payroll run'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'gross',
      label: 'Gross',
      render: (row) => formatPayrollMoney(row.totalGross, row.payrollCurrency, row.payrollCountry),
    },
    {
      key: 'tax',
      label: 'PAYE',
      render: (row) => formatPayrollMoney(row.totalPAYE, row.payrollCurrency, row.payrollCountry),
    },
    {
      key: 'net',
      label: 'Net Pay',
      render: (row) => (
        <span className="font-semibold text-emerald-600">
          {formatPayrollMoney(row.totalNet, row.payrollCurrency, row.payrollCountry)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
        <MetricCard
          title="Commission Entry"
          value="Draft Payroll"
          icon={TrendingUp}
          variant="highlight"
        />
        <MetricCard title="Tax Source" value="Backend PAYE" icon={FileText} variant="success" />
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
        <p className="text-sm font-medium text-blue-900">
          Commissions are finalized in payroll drafts.
        </p>
        <p className="text-xs text-blue-700 mt-1">
          Open Manage Payroll, enter commission amounts for the draft run, and WorkPhelo will use
          the backend payroll engine for PAYE, fixed tax, exempt tax, gross pay, and net pay.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={draftRuns}
        isLoading={isLoading}
        emptyMessage="No draft payroll run available. Create a draft from Manage Payroll to enter commissions."
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
      />
    </div>
  );
}
