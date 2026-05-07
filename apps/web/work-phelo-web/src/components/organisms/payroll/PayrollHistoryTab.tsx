'use client';

import { Download } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/atoms/Button';
import { Column, DataTable } from '../shared/DataTable';
import { PayrollRun } from '@/types/hr';
import { usePayrollRuns } from '@/hooks';

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

function monthLabel(run: PayrollRun) {
  return `${MONTH_NAMES[run.month]} ${run.year}`;
}

export function PayrollHistoryTab() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const { data: runs = [], isLoading } = usePayrollRuns();

  const history = runs.filter((r) => r.status === 'APPROVED' || r.status === 'PAID');

  const columns: Column<PayrollRun>[] = [
    {
      key: 'month',
      label: 'Month',
      render: (row) => <span className="font-medium text-gray-900">{monthLabel(row)}</span>,
    },
    {
      key: 'totalGross',
      label: 'Total Gross',
      render: (row) => fmt(row.totalGross),
    },
    {
      key: 'totalAllowances',
      label: 'Total Allowances',
      render: () => <span className="text-gray-400">—</span>,
    },
    {
      key: 'totalSSNIT',
      label: 'Total SSNIT',
      render: (row) => fmt(row.totalSSNIT),
    },
    {
      key: 'totalPAYE',
      label: 'Total PAYE',
      render: (row) => fmt(row.totalPAYE),
    },
    {
      key: 'employerCost',
      label: 'Employer Cost',
      render: () => <span className="text-gray-400">—</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        const isPaid = row.status === 'PAID';
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
            }`}
          >
            {isPaid ? 'Paid' : 'Approved'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: '',
      width: '100px',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push(`/${params.tenantSlug}/hr/payroll/history/${row.id}`)}
          >
            View
          </Button>
          <button
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Download payslips"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <DataTable
        columns={columns}
        data={history}
        isLoading={isLoading}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
      />
    </div>
  );
}
