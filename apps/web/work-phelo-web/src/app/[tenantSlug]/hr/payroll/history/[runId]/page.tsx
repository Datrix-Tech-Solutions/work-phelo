'use client';

import { use } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';
import { Column, DataTable } from '@/components/organisms/shared/DataTable';
import { usePayrollRun } from '@/hooks';
import { PayrollItem } from '@/types/hr';

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

const columns: Column<PayrollItem>[] = [
  {
    key: 'employee',
    label: 'Employee',
    width: '2fr',
    render: (row) => (
      <div>
        <p className="font-medium text-gray-900">
          {row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : '—'}
        </p>
        {row.employee?.jobTitle && <p className="text-xs text-gray-400">{row.employee.jobTitle}</p>}
      </div>
    ),
  },
  {
    key: 'basicSalary',
    label: 'Basic Salary',
    render: (row) => fmt(row.basicSalary),
  },
  {
    key: 'totalAllowances',
    label: 'Allowances',
    render: (row) => fmt(row.totalAllowances),
  },
  {
    key: 'grossSalary',
    label: 'Gross',
    render: (row) => fmt(row.grossSalary),
  },
  {
    key: 'employeeSSNIT',
    label: 'SSNIT',
    render: (row) => fmt(row.employeeSSNIT),
  },
  {
    key: 'payeTax',
    label: 'PAYE',
    render: (row) => fmt(row.payeTax),
  },
  {
    key: 'netSalary',
    label: 'Net Salary',
    render: (row) => <span className="font-semibold text-emerald-600">{fmt(row.netSalary)}</span>,
  },
  {
    key: 'download',
    label: '',
    width: '60px',
    render: (row) => (
      <button
        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title={`Download ${row.employee?.firstName ?? ''} payslip`}
      >
        <Download className="w-4 h-4" />
      </button>
    ),
  },
];

export default function PayrollHistoryDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; runId: string }>;
}) {
  const { tenantSlug, runId } = use(params);
  const { data: run, isLoading } = usePayrollRun(runId);

  const periodLabel = run ? `${MONTH_NAMES[run.month]} ${run.year}` : '—';

  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between shrink-0">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link
            href={`/${tenantSlug}/hr/payroll?tab=history`}
            className="hover:text-gray-700 transition-colors"
          >
            History
          </Link>
          <Icons.ChevronRight className="w-4 h-4" />
          <span className="text-gray-700 font-medium">{periodLabel}</span>
        </nav>

        <Button>
          <Download className="w-4 h-4 mr-2" />
          Download All
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={run?.items ?? []}
        isLoading={isLoading}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
      />
    </div>
  );
}
