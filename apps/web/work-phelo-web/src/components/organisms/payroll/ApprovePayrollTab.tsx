'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MoreVertical } from 'lucide-react';
import { Column, DataTable } from '../shared/DataTable';
import { PayrollRun } from '@/types/hr';
import { usePayrollRuns, useReturnPayrollToDraft } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { ApprovePayrollPanel } from './ApprovePayrollPanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { payrollMonthLabel } from '@/lib/payrollUtils';

function fmt(value: string | number | null | undefined) {
  if (value == null) return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '—';
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function monthLabel(run: PayrollRun) {
  return payrollMonthLabel(run.month, run.year);
}

interface RowMenuProps {
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
}

function RowMenu({ onView, onApprove, onReject }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-10 w-36 bg-white border border-gray-100 rounded-xl shadow-lg py-1 overflow-hidden">
          <button
            onClick={() => {
              setOpen(false);
              onView();
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            View
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onApprove();
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onReject();
            }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export function ApprovePayrollTab() {
  const toast = useToast();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const { data: runs = [], isLoading } = usePayrollRuns();
  const { mutate: returnToDraft, isPending: isRejecting } = useReturnPayrollToDraft();
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [rejectRun, setRejectRun] = useState<PayrollRun | null>(null);

  const pending = runs.filter((r) => r.status === 'PENDING_APPROVAL');

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
      key: 'totalNet',
      label: 'Total Net Pay',
      render: (row) => fmt(row.totalNet),
    },
    {
      key: 'totalPAYE',
      label: 'Total PAYE',
      render: (row) => fmt(row.totalPAYE),
    },
    {
      key: 'totalSSNIT',
      label: 'Total SSNIT',
      render: (row) => fmt(row.totalSSNIT),
    },
    {
      key: 'totalEmployerCost',
      label: 'Total Employer Cost',
      render: (row) => fmt(row.totalEmployerCost),
    },
    {
      key: 'actions',
      label: '',
      width: '50px',
      render: (row) => (
        <RowMenu
          onView={() => router.push(`/${params.tenantSlug}/hr/payroll/approve/${row.id}`)}
          onApprove={() => setSelectedRun(row)}
          onReject={() => setRejectRun(row)}
        />
      ),
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <DataTable
        columns={columns}
        data={pending}
        emptyMessage="You have no payrolls to approve"
        isLoading={isLoading}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
      />

      <ApprovePayrollPanel run={selectedRun} onClose={() => setSelectedRun(null)} />

      <Modal
        isOpen={rejectRun !== null}
        onClose={() => !isRejecting && setRejectRun(null)}
        title="Reject Payroll"
        hideClose={isRejecting}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectRun(null)} disabled={isRejecting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isRejecting}
              loadingText="Rejecting…"
              onClick={() => {
                if (!rejectRun) return;
                returnToDraft(rejectRun.id, {
                  onSuccess: () => {
                    toast.success(`${monthLabel(rejectRun)} payroll returned to draft`);
                    setRejectRun(null);
                  },
                  onError: (err) => toast.error(extractError(err, 'Failed to reject payroll')),
                });
              }}
            >
              Reject Payroll
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 leading-relaxed mt-2">
          You are about to reject the payroll for{' '}
          <span className="font-medium text-gray-900">
            {rejectRun ? monthLabel(rejectRun) : ''}
          </span>
          . It will be returned to draft and the payroll manager will need to resubmit. This action
          cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
