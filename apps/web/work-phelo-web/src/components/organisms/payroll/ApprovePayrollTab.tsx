'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/atoms/Button';
import { Column, DataTable } from '../shared/DataTable';
import { PayrollRun } from '@/types/hr';
import { usePayrollRuns, useReturnPayrollToDraft } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { ApprovePayrollPanel } from './ApprovePayrollPanel';
import { Modal } from '@/components/organisms/shared/Modal';

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
      key: 'actions',
      label: '',
      width: '200px',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push(`/${params.tenantSlug}/hr/payroll/approve/${row.id}`)}
          >
            View
          </Button>
          <Button size="sm" onClick={() => setSelectedRun(row)}>
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRejectRun(row)}>
            Reject
          </Button>
        </div>
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
