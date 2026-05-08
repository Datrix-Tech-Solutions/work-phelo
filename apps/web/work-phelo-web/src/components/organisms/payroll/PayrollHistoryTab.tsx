'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/atoms/Button';
import { Column, DataTable } from '../shared/DataTable';
import { PayrollRun, PayrollRunDetail } from '@/types/hr';
import { usePayrollRuns } from '@/hooks';
import {
  payrollMonthLabel,
  downloadPayrollBankFormat,
  downloadPayrollFullFormat,
  downloadPayrollPDFFormat,
} from '@/lib/payrollUtils';
import { api } from '@/lib/api';

function fmt(value: string | number) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function DownloadMenu({ run }: { run: PayrollRun }) {
  const [open, setOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<'bank' | 'full' | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const label = payrollMonthLabel(run.month, run.year).replace(' ', '-');

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

  const fetchDetail = () =>
    queryClient.fetchQuery({
      queryKey: ['payroll', run.id],
      queryFn: async () => {
        const res = await api.get<PayrollRunDetail>(`/hr/payroll/${run.id}`);
        return res.data;
      },
    });

  const handleFileType = async (type: 'csv' | 'pdf') => {
    const format = pendingFormat!;
    setPendingFormat(null);
    setLoading(true);
    try {
      const detail = await fetchDetail();
      if (type === 'csv') {
        if (format === 'bank') downloadPayrollBankFormat(detail, label);
        else downloadPayrollFullFormat(detail, label);
      } else {
        await downloadPayrollPDFFormat(detail, label, format);
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
        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="Download"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-10 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1 overflow-hidden">
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
        <div className="absolute right-0 top-8 z-10 w-44 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
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

export function PayrollHistoryTab() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const { data: runs = [], isLoading } = usePayrollRuns();

  const history = runs.filter((r) => r.status === 'APPROVED' || r.status === 'PAID');

  const columns: Column<PayrollRun>[] = [
    {
      key: 'month',
      label: 'Month',
      render: (row) => (
        <span className="font-medium text-gray-900">{payrollMonthLabel(row.month, row.year)}</span>
      ),
    },
    {
      key: 'totalGross',
      label: 'Total Gross',
      render: (row) => `GHS ${fmt(row.totalGross)}`,
    },
    {
      key: 'totalTier1',
      label: 'Total Tier 1 Employee',
      render: (row) => fmt(row.totalTier1),
    },
    {
      key: 'totalSSNIT',
      label: 'Total SSNIT',
      render: (row) => `GHS ${fmt(row.totalSSNIT)}`,
    },
    {
      key: 'totalPAYE',
      label: 'Total PAYE',
      render: (row) => `GHS ${fmt(row.totalPAYE)}`,
    },
    {
      key: 'totalSSNIT',
      label: 'Total SSNIT',
      render: (row) => fmt(row.totalSSNIT),
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
          <DownloadMenu run={row} />
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
