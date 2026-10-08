'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { TypeChip } from '@/components/atoms/TypeChip';
import { cardClass } from '@/lib/utils';
import {
  useApprovePayrollMonth,
  usePayrollRun,
  usePayrollRuns,
  useReturnPayrollToDraft,
} from '@/hooks/hr/usePayroll';
import { payrollConfigurationError } from '@/hooks/hr/usePayrollConfigurations';
import { useToast } from '@/hooks/useToast';
import { PAYSLIP_TYPES, formatAmount, type PayslipTypeKey } from '@/lib/payroll-engine';
import type { PayrollItem, PayrollRun } from '@/types/hr';
import { StoredPayslipPanel } from './StoredPayslipPanel';

const typeLabel = (key: string | undefined) =>
  key && key in PAYSLIP_TYPES ? PAYSLIP_TYPES[key as PayslipTypeKey].label : 'Payroll';

const periodLabel = (run: { month: number; year: number }) =>
  new Date(run.year, run.month - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

const n = (value: string | undefined | null) => Number(value ?? 0);

/** One run waiting for approval: its totals, and a way to send it back. */
function RunCard({ run, onReturn }: { run: PayrollRun; onReturn: (run: PayrollRun) => void }) {
  const currency = run.payrollCurrency;
  const { data: detail } = usePayrollRun(run.id);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">{typeLabel(run.payslipKey)}</span>
        <TypeChip label="Waiting for approval" color="amber" />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-500">
        <dt>Payslips</dt>
        <dd className="text-right text-gray-900">{detail ? detail.items.length : '-'}</dd>
        <dt>Gross pay</dt>
        <dd className="text-right tabular-nums text-gray-900">
          {formatAmount(n(run.totalGross), currency)}
        </dd>
        <dt>Net pay</dt>
        <dd className="text-right tabular-nums text-gray-900">
          {formatAmount(n(run.totalNet), currency)}
        </dd>
        <dt>Employer cost</dt>
        <dd className="text-right tabular-nums text-gray-900">
          {formatAmount(n(run.totalEmployerCost), currency)}
        </dd>
      </dl>
      {run.notes && (
        <p className="rounded-md bg-gray-50 px-2 py-1.5 text-xs text-gray-600">
          <span className="font-medium text-gray-700">Message: </span>
          {run.notes}
        </p>
      )}
      <Button variant="outline" size="sm" onClick={() => onReturn(run)}>
        Return to draft
      </Button>
    </div>
  );
}

/** The payslips of one run, read-only. */
function RunPayslips({ run }: { run: PayrollRun }) {
  const currency = run.payrollCurrency;
  const { data: detail, isLoading } = usePayrollRun(run.id);
  const [selected, setSelected] = useState<PayrollItem | null>(null);

  const columns: Column<PayrollItem>[] = [
    {
      key: 'name',
      label: 'Employee',
      render: (i) => (
        <span className="font-medium text-gray-900">
          {i.employee ? `${i.employee.firstName} ${i.employee.lastName}` : '-'}
        </span>
      ),
    },
    { key: 'gross', label: 'Gross', render: (i) => formatAmount(n(i.grossSalary), currency) },
    {
      key: 'deductions',
      label: 'Deductions',
      render: (i) => formatAmount(n(i.totalDeductions), currency),
    },
    {
      key: 'net',
      label: 'Net pay',
      render: (i) => (
        <span className="font-semibold text-gray-900">
          {formatAmount(n(i.netSalary), currency)}
        </span>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={detail?.items ?? []}
        isLoading={isLoading}
        onRowClick={(item) => setSelected(item)}
        emptyMessage="No payslips in this run."
        currentPage={1}
        totalPages={1}
        onPageChange={() => undefined}
        noInternalScroll
      />
      {selected && (
        <StoredPayslipPanel item={selected} currency={currency} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

/** Everything waiting for approval for one month, with a single Approve button. */
function PeriodSection({ runs }: { runs: PayrollRun[] }) {
  const toast = useToast();
  const approve = useApprovePayrollMonth();
  const returnToDraft = useReturnPayrollToDraft();
  const [chosen, setChosen] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const [returning, setReturning] = useState<PayrollRun | null>(null);
  const [returnNote, setReturnNote] = useState('');
  const [failures, setFailures] = useState<string[]>([]);

  const first = runs[0];
  const active = runs.find((r) => r.id === chosen) ?? first;

  const closeApproval = () => {
    setApproving(false);
    setFailures([]);
  };

  // Anything that goes wrong stays in the pop-up, where the person can read it and try again.
  const doApprove = async () => {
    setFailures([]);
    try {
      const result = await approve.mutateAsync({
        month: first.month,
        year: first.year,
        note: approveNote.trim() || undefined,
      });
      if (result.approved.length) {
        toast.success(
          `Approved ${result.approved.length} ${result.approved.length === 1 ? 'run' : 'runs'}.`,
        );
      }
      if (result.failed.length) {
        setFailures(result.failed.map((f) => `${typeLabel(f.payslipType)}: ${f.message}`));
      } else {
        closeApproval();
        setApproveNote('');
      }
    } catch (e) {
      setFailures([payrollConfigurationError(e, 'Could not approve payroll')]);
    }
  };

  const doReturn = async () => {
    if (!returning) return;
    try {
      await returnToDraft.mutateAsync({ id: returning.id, note: returnNote.trim() });
      toast.success(`${typeLabel(returning.payslipKey)} payroll returned to draft.`);
      setReturning(null);
      setReturnNote('');
    } catch (e) {
      toast.error(payrollConfigurationError(e, 'Could not return payroll to draft'));
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-gray-900">{periodLabel(first)}</h2>
        <Button onClick={() => setApproving(true)} disabled={approve.isPending}>
          Approve payroll
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {runs.map((run) => (
          <RunCard key={run.id} run={run} onReturn={setReturning} />
        ))}
      </div>

      <TabBar
        tabs={runs.map((r) => ({ key: r.id, label: typeLabel(r.payslipKey) }))}
        activeTab={active.id}
        onTabChange={setChosen}
      />
      <RunPayslips key={active.id} run={active} />

      <Modal
        isOpen={approving}
        onClose={closeApproval}
        title="Approve payroll"
        description={`This approves ${runs.map((r) => typeLabel(r.payslipKey)).join(', ')} for ${periodLabel(first)}. Each posts to accounting if payroll is linked there.`}
        footer={
          <>
            <Button variant="ghost" onClick={closeApproval}>
              Cancel
            </Button>
            <Button
              onClick={() => void doApprove()}
              isLoading={approve.isPending}
              loadingText="Approving…"
            >
              Approve
            </Button>
          </>
        }
      >
        <div className="mt-3 flex flex-col gap-3">
          {failures.length > 0 && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <p className="font-medium">These could not be approved and are still waiting:</p>
              <ul className="mt-1 list-disc pl-5">
                {failures.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}
          <Input
            label="Note (optional)"
            value={approveNote}
            onChange={(e) => setApproveNote(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        isOpen={returning !== null}
        onClose={() => setReturning(null)}
        title="Return to draft"
        description={`Sends ${typeLabel(returning?.payslipKey)} payroll back to be changed and run again. Say what needs fixing.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReturning(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!returnNote.trim()}
              onClick={() => void doReturn()}
              isLoading={returnToDraft.isPending}
              loadingText="Returning…"
            >
              Return to draft
            </Button>
          </>
        }
      >
        <div className="mt-3">
          <Input
            label="What needs fixing"
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
          />
        </div>
      </Modal>
    </section>
  );
}

/**
 * Approve Payroll: every run waiting for approval, grouped by month, each with its payslips. One
 * button approves all the runs of a month together.
 */
export function ApprovePayrollContent() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data: runs = [], isLoading } = usePayrollRuns();

  const periods = useMemo(() => {
    const pending = runs.filter(
      (r) => r.status === 'PENDING_APPROVAL' && r.payslipKey && r.payslipKey !== 'legacy',
    );
    const byPeriod = new Map<string, PayrollRun[]>();
    pending.forEach((r) => {
      const key = `${r.year}-${r.month}`;
      byPeriod.set(key, [...(byPeriod.get(key) ?? []), r]);
    });
    return [...byPeriod.entries()].sort(([a], [b]) => (a < b ? 1 : -1)).map(([, list]) => list);
  }, [runs]);

  if (isLoading) {
    return <div className={cardClass('p-6 text-center text-sm text-gray-500')}>Loading…</div>;
  }

  if (periods.length === 0) {
    return (
      <div className="rounded-lg bg-gray-100 px-4 py-6 text-center text-sm text-gray-600">
        <p className="font-medium text-gray-900">Nothing is waiting for approval.</p>
        <p className="mt-1">
          Payroll you run on{' '}
          <Link
            href={`/${tenantSlug}/hr/payroll/manage`}
            className="font-medium underline underline-offset-2"
          >
            Manage Payroll
          </Link>{' '}
          will appear here, with its payslips and one button to approve it. Earlier runs are in
          History.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {periods.map((list) => (
        <PeriodSection key={`${list[0].year}-${list[0].month}`} runs={list} />
      ))}
    </div>
  );
}
