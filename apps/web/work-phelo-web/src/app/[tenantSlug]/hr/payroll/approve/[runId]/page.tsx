'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { Column, DataTable } from '@/components/organisms/shared/DataTable';
import { usePayrollRun, useApprovePayroll, useReturnPayrollToDraft } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { PayrollItem } from '@/types/hr';
import { payrollMonthLabel } from '@/lib/payrollUtils';

function fmt(value: string | number | null | undefined) {
  if (value == null) return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '—';
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function LineItemsCell({
  items,
  fallback,
}: {
  items: Array<{ name: string; amount: string }> | undefined;
  fallback: string;
}) {
  const active = (items ?? [])
    .map((item) => ({ name: item.name, amount: parseFloat(item.amount) }))
    .filter((item) => item.amount > 0);

  if (active.length === 0) {
    return <span>{fmt(fallback)}</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {active.map((item, index) => (
        <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500 truncate max-w-28">{item.name}</span>
          <span className="text-xs tabular-nums text-gray-800">{fmt(item.amount)}</span>
        </div>
      ))}
    </div>
  );
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
    render: (row) => <LineItemsCell items={row.allowanceItems} fallback={row.totalAllowances} />,
  },
  {
    key: 'grossSalary',
    label: 'Gross',
    render: (row) => fmt(row.grossSalary),
  },
  {
    key: 'employeeSSNIT',
    label: 'Employee Total (5.5%)',
    render: (row) => fmt(row.employeeSSNIT),
  },
  {
    key: 'tier1Contribution',
    label: 'Tier 1 Employee (0.5%)',
    render: (row) => fmt(row.tier1Contribution),
  },
  {
    key: 'tier2Contribution',
    label: 'Tier 2 Employee (5%)',
    render: (row) => fmt(row.tier2Contribution),
  },
  {
    key: 'payeTax',
    label: 'PAYE',
    render: (row) => fmt(row.payeTax),
  },
  {
    key: 'otherDeductions',
    label: 'Deductions',
    render: (row) => <LineItemsCell items={row.deductionItems} fallback={row.otherDeductions} />,
  },
  {
    key: 'netSalary',
    label: 'Net Salary',
    render: (row) => <span className="font-semibold text-emerald-600">{fmt(row.netSalary)}</span>,
  },
];

export default function ApprovePayrollDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; runId: string }>;
}) {
  const { tenantSlug, runId } = use(params);
  const router = useRouter();
  const toast = useToast();

  const { data: run, isLoading } = usePayrollRun(runId);
  const { mutateAsync: approvePayroll, isPending: isApproving } = useApprovePayroll();
  const { mutateAsync: returnToDraft, isPending: isRejecting } = useReturnPayrollToDraft();

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');
  const [returnNote, setReturnNote] = useState('');

  const isPending = isApproving || isRejecting;
  const periodLabel = run ? payrollMonthLabel(run.month, run.year) : '—';
  const backHref = `/${tenantSlug}/hr/payroll?tab=approve`;

  const handleApprove = async () => {
    try {
      await approvePayroll({ id: runId, note: approvalNote.trim() });
      toast.success(`${periodLabel} payroll approved`);
      router.push(backHref);
    } catch (err) {
      toast.error(extractError(err, 'Failed to approve payroll'));
    }
  };

  const handleReject = async () => {
    try {
      await returnToDraft({ id: runId, note: returnNote.trim() });
      toast.success(`${periodLabel} payroll returned to draft`);
      router.push(backHref);
    } catch (err) {
      toast.error(extractError(err, 'Failed to reject payroll'));
    }
  };

  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between shrink-0">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={backHref} className="hover:text-gray-700 transition-colors">
            Approve
          </Link>
          <Icons.ChevronRight className="w-4 h-4" />
          <span className="text-gray-700 font-medium">{periodLabel}</span>
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowRejectModal(true)} disabled={isPending}>
            Reject
          </Button>
          <Button
            onClick={() => setShowApproveModal(true)}
            disabled={isPending || !approvalNote.trim()}
          >
            Approve Payroll
          </Button>
        </div>
      </div>

      <SectionCard
        title={`${periodLabel} Payroll`}
        className="flex-1 min-h-0 flex flex-col"
        contentClassName="flex-1 min-h-0 flex flex-col"
      >
        <DataTable
          columns={columns}
          data={run?.items ?? []}
          isLoading={isLoading}
          currentPage={1}
          totalPages={1}
          onPageChange={() => {}}
        />

        <div className="rounded-2xl border border-gray-100 bg-white p-5 flex flex-col gap-2">
          <label className="text-sm font-bold text-gray-900">
            Approval Note <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={4}
            placeholder="Explain why this payroll is being approved…"
            value={approvalNote}
            onChange={(e) => setApprovalNote(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-lg border text-gray-900 border-gray-200 bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 placeholder:text-gray-400 resize-none transition-colors"
          />
        </div>
      </SectionCard>

      {/* Approve confirmation */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => !isPending && setShowApproveModal(false)}
        title="Approve Payroll"
        hideClose={isPending}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setShowApproveModal(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              isLoading={isApproving}
              loadingText="Approving…"
              disabled={!approvalNote.trim()}
            >
              Approve Payroll
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 leading-relaxed mt-2">
          You are about to approve the payroll for{' '}
          <span className="font-medium text-gray-900">{periodLabel}</span>. Once approved, payslips
          will be finalised and the payroll will be marked as ready for payment.
        </p>
        {approvalNote.trim() && (
          <p className="text-sm text-gray-500 leading-relaxed mt-3">
            Approval note: <span className="text-gray-700">{approvalNote.trim()}</span>
          </p>
        )}
      </Modal>

      {/* Reject confirmation */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => !isPending && setShowRejectModal(false)}
        title="Reject Payroll"
        hideClose={isPending}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setShowRejectModal(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              isLoading={isRejecting}
              loadingText="Rejecting…"
              disabled={!returnNote.trim()}
            >
              Reject Payroll
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 leading-relaxed mt-2">
          You are about to reject the payroll for{' '}
          <span className="font-medium text-gray-900">{periodLabel}</span>. It will be returned to
          draft and the payroll manager will need to resubmit.
        </p>
        <div className="flex flex-col gap-1.5 mt-4">
          <label className="text-sm font-bold text-gray-900">
            Return Note <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={4}
            placeholder="Explain why this payroll is being returned to draft…"
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-lg border text-gray-900 border-gray-200 bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 placeholder:text-gray-400 resize-none transition-colors"
          />
        </div>
      </Modal>
    </div>
  );
}
