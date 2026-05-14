'use client';

import { use, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Download, Loader2 } from 'lucide-react';
import { Icons } from '@/components/atoms/icons';
import { Column, DataTable } from '@/components/organisms/shared/DataTable';
import { usePayrollRun } from '@/hooks';
import { PayrollItem, PayrollRunDetail } from '@/types/hr';
import { useAuthStore } from '@/store/auth.store';
import {
  payrollMonthLabel,
  downloadPayrollBankFormat,
  downloadPayrollFullFormat,
  downloadPayrollPDFFormat,
} from '@/lib/payrollUtils';
import { formatPayrollMoney, getPayrollLabels } from '@/lib/payrollDisplay';

function DownloadAllMenu({ detail, label }: { detail: PayrollRunDetail; label: string }) {
  const [open, setOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<'bank' | 'full' | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const companyName = useAuthStore((s) => s.user?.tenantName ?? '');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPendingFormat(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleFileType = async (type: 'csv' | 'pdf') => {
    const format = pendingFormat!;
    setPendingFormat(null);
    setLoading(true);
    try {
      if (type === 'csv') {
        if (format === 'bank') downloadPayrollBankFormat(detail, label, companyName);
        else downloadPayrollFullFormat(detail, label, companyName);
      } else {
        await downloadPayrollPDFFormat(detail, label, format, companyName);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          if (!loading) {
            setOpen((v) => !v);
            setPendingFormat(null);
          }
        }}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        disabled={loading}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Download
        <Icons.ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-10 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1 overflow-hidden">
          <button
            onClick={() => {
              setOpen(false);
              setPendingFormat('bank');
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Bank format
          </button>
          <button
            onClick={() => {
              setOpen(false);
              setPendingFormat('full');
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Full format
          </button>
        </div>
      )}

      {pendingFormat && (
        <div className="absolute right-0 top-full mt-1.5 z-10 w-44 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
          <p className="px-4 pt-3 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {pendingFormat === 'bank' ? 'Bank format' : 'Full format'}
          </p>
          <button
            onClick={() => handleFileType('csv')}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            CSV
          </button>
          <button
            onClick={() => handleFileType('pdf')}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            PDF
          </button>
        </div>
      )}
    </div>
  );
}

function totalAllowances(row: PayrollItem): number {
  if (row.allowanceItems?.length) {
    return row.allowanceItems.reduce((s, a) => s + parseFloat(a.amount), 0);
  }
  return parseFloat(row.totalAllowances) + parseFloat(row.transportAmount);
}

function totalDeductions(row: PayrollItem): number {
  if (row.deductionItems?.length) {
    return row.deductionItems.reduce((s, d) => s + parseFloat(d.amount), 0);
  }
  return parseFloat(row.otherDeductions);
}

export default function PayrollHistoryDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; runId: string }>;
}) {
  const { tenantSlug, runId } = use(params);
  const { data: run, isLoading } = usePayrollRun(runId);

  const periodLabel = run ? payrollMonthLabel(run.month, run.year) : '—';
  const fileLabel = periodLabel.replace(' ', '-');
  const payrollLabels = getPayrollLabels(run?.payrollCountry);
  const money = (value: string | number | null | undefined) =>
    formatPayrollMoney(value, run?.payrollCurrency, run?.payrollCountry);

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
          {row.employee?.jobTitle && (
            <p className="text-xs text-gray-400">{row.employee.jobTitle}</p>
          )}
        </div>
      ),
    },
    { key: 'basicSalary', label: 'Basic Salary', render: (row) => money(row.basicSalary) },
    { key: 'totalAllowances', label: 'Allowances', render: (row) => money(totalAllowances(row)) },
    { key: 'otherDeductions', label: 'Deductions', render: (row) => money(totalDeductions(row)) },
    { key: 'grossSalary', label: 'Gross', render: (row) => money(row.grossSalary) },
    {
      key: 'employeeSSNIT',
      label: payrollLabels.employeeLabel,
      render: (row) => money(row.employeeSSNIT),
    },
    { key: 'payeTax', label: 'PAYE', render: (row) => money(row.payeTax) },
    {
      key: 'netSalary',
      label: 'Net Salary',
      render: (row) => (
        <span className="font-semibold text-emerald-600">{money(row.netSalary)}</span>
      ),
    },
  ];

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

        {run && <DownloadAllMenu detail={run} label={fileLabel} />}
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
