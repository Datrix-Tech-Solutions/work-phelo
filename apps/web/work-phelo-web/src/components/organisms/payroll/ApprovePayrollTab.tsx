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
import { formatPayrollMoney, getPayrollLabels } from '@/lib/payrollDisplay';

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
  const [returnNote, setReturnNote] = useState('');

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
      render: (row) => formatPayrollMoney(row.totalGross, row.payrollCurrency, row.payrollCountry),
    },
    {
      key: 'totalNet',
      label: 'Total Net Pay',
      render: (row) => formatPayrollMoney(row.totalNet, row.payrollCurrency, row.payrollCountry),
    },
    {
      key: 'totalPAYE',
      label: 'Total PAYE',
      render: (row) => formatPayrollMoney(row.totalPAYE, row.payrollCurrency, row.payrollCountry),
    },
    {
      key: 'totalSSNIT',
      label: 'Statutory',
      render: (row) => (
        <span title={getPayrollLabels(row.payrollCountry).totalLabel}>
          {formatPayrollMoney(row.totalSSNIT, row.payrollCurrency, row.payrollCountry)}
        </span>
      ),
    },
    {
      key: 'totalEmployerCost',
      label: 'Total Employer Cost',
      render: (row) =>
        formatPayrollMoney(row.totalEmployerCost, row.payrollCurrency, row.payrollCountry),
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
        onClose={() => {
          if (isRejecting) return;
          setRejectRun(null);
          setReturnNote('');
        }}
        title="Reject Payroll"
        hideClose={isRejecting}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setRejectRun(null);
                setReturnNote('');
              }}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isRejecting}
              loadingText="Rejecting…"
              disabled={!returnNote.trim()}
              onClick={() => {
                if (!rejectRun) return;
                returnToDraft(
                  { id: rejectRun.id, note: returnNote.trim() },
                  {
                    onSuccess: () => {
                      toast.success(`${monthLabel(rejectRun)} payroll rejected`);
                      setRejectRun(null);
                      setReturnNote('');
                    },
                    onError: (err) => toast.error(extractError(err, 'Failed to reject payroll')),
                  },
                );
              }}
            >
              Reject Payroll
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 mt-2">
          <p className="text-sm text-gray-600 leading-relaxed">
            You are about to reject the payroll for{' '}
            <span className="font-medium text-gray-900">
              {rejectRun ? monthLabel(rejectRun) : ''}
            </span>
            . The payroll manager will need to revise and resubmit.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-900">
              Rejection Note <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="Explain why this payroll is being rejected…"
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border text-gray-900 border-gray-200 bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 placeholder:text-gray-400 resize-none transition-colors"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
