'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, FileText } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { usePayrollRuns } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { PayrollRun, PayrollRunDetail } from '@/types/hr';
import { AllowanceItem } from '@/lib/payrollCalculations';
import { payrollMonthLabel } from '@/lib/payrollUtils';
import { api } from '@/lib/api';
import type { DeductionLineItem } from './DeductionsPanel';

function fmt(value: string | number) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '—';
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface DraftLoadData {
  basicMap: Record<string, number>;
  allowancesMap: Record<string, AllowanceItem[]>;
  deductionItemsMap: Record<string, DeductionLineItem[]>;
}

async function loadRunData(
  run: PayrollRun,
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<DraftLoadData> {
  const detail = await queryClient.fetchQuery<PayrollRunDetail>({
    queryKey: ['payroll', run.id],
    queryFn: async () => {
      const res = await api.get<PayrollRunDetail>(`/hr/payroll/${run.id}`);
      return res.data;
    },
  });

  const basicMap: Record<string, number> = {};
  const allowancesMap: Record<string, AllowanceItem[]> = {};
  const deductionItemsMap: Record<string, DeductionLineItem[]> = {};

  for (const item of detail.items) {
    basicMap[item.employeeId] = parseFloat(item.basicSalary);
    if (item.allowanceItems?.length) {
      allowancesMap[item.employeeId] = item.allowanceItems.map((allowance) => ({
        name: allowance.name,
        type: allowance.type ?? undefined,
        amount: parseFloat(allowance.amount),
      }));
    } else {
      const transportAmount = parseFloat(item.transportAmount);
      const totalAllowances = parseFloat(item.totalAllowances);
      const allowances: AllowanceItem[] = [];
      if (transportAmount > 0) {
        allowances.push({
          name: 'Transport Allowance',
          type: 'TRANSPORT',
          amount: transportAmount,
        });
      }
      if (totalAllowances > 0) {
        allowances.push({ name: 'Allowances', amount: totalAllowances });
      }
      if (allowances.length > 0) {
        allowancesMap[item.employeeId] = allowances;
      }
    }

    if (item.deductionItems?.length) {
      deductionItemsMap[item.employeeId] = item.deductionItems.map((deduction) => ({
        employeeDeductionId: deduction.employeeDeductionId ?? null,
        name: deduction.name,
        amount: parseFloat(deduction.amount),
      }));
    } else if (parseFloat(item.otherDeductions) > 0) {
      deductionItemsMap[item.employeeId] = [
        { name: 'Deductions', amount: parseFloat(item.otherDeductions) },
      ];
    }
  }

  return { basicMap, allowancesMap, deductionItemsMap };
}

function ApprovedRunCard({
  run,
  onLoad,
}: {
  run: PayrollRun;
  onLoad: (data: DraftLoadData) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleUse = async () => {
    setLoading(true);
    try {
      const data = await loadRunData(run, queryClient);
      onLoad(data);
      toast.success(`${payrollMonthLabel(run.month, run.year)} loaded into payroll table`);
    } catch (err) {
      toast.error(extractError(err, 'Failed to load payroll run'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-emerald-100 bg-emerald-50">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-gray-900">
            {payrollMonthLabel(run.month, run.year)}
          </p>
          <p className="text-xs text-gray-500">
            Net Pay: {fmt(run.totalNet)} · Gross: {fmt(run.totalGross)}
          </p>
          {run.approvedAt && (
            <p className="text-xs text-emerald-600">
              Approved{' '}
              {new Date(run.approvedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleUse}
        isLoading={loading}
        loadingText="Loading…"
      >
        Use Values
      </Button>
    </div>
  );
}

function ReturnedRunCard({
  run,
  onLoad,
}: {
  run: PayrollRun;
  onLoad: (data: DraftLoadData) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleUse = async () => {
    setLoading(true);
    try {
      const data = await loadRunData(run, queryClient);
      onLoad(data);
      toast.success(`${payrollMonthLabel(run.month, run.year)} loaded into payroll table`);
    } catch (err) {
      toast.error(extractError(err, 'Failed to load payroll run'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-red-100 bg-red-50">
      <div className="flex items-start gap-3">
        <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">
              {payrollMonthLabel(run.month, run.year)}
            </p>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-600">
              Rejected
            </span>
          </div>
          <p className="text-xs text-gray-500">Gross: {fmt(run.totalGross)}</p>
          {run.returnToDraftNote && (
            <p className="text-xs text-red-500 italic">&quot;{run.returnToDraftNote}&quot;</p>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleUse}
        isLoading={loading}
        loadingText="Loading…"
      >
        Revise
      </Button>
    </div>
  );
}

function DraftRunCard({ run, onLoad }: { run: PayrollRun; onLoad: (data: DraftLoadData) => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleUse = async () => {
    setLoading(true);
    try {
      const data = await loadRunData(run, queryClient);
      onLoad(data);
      toast.success(`${payrollMonthLabel(run.month, run.year)} loaded into payroll table`);
    } catch (err) {
      toast.error(extractError(err, 'Failed to load draft'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-100 bg-gray-50">
      <div className="flex items-start gap-3">
        <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-gray-900">
            {payrollMonthLabel(run.month, run.year)}
          </p>
          <p className="text-xs text-gray-500">Gross: {fmt(run.totalGross)}</p>
          {run.notes && (
            <p className="text-xs text-gray-400 italic truncate max-w-48">{run.notes}</p>
          )}
        </div>
      </div>
      <Button size="sm" onClick={handleUse} isLoading={loading} loadingText="Loading…">
        Use
      </Button>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{title}</p>
      <span className="text-xs text-gray-300 font-medium">{count}</span>
    </div>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (data: DraftLoadData) => void;
}

export function PayrollDraftsPanel({ isOpen, onClose, onLoad }: Props) {
  const { data: runs = [], isLoading } = usePayrollRuns();

  const recentApproved = runs
    .filter((r) => r.status === 'APPROVED' || r.status === 'PAID')
    .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month))
    .slice(0, 3);

  const returned = runs
    .filter((r) => r.status === 'DRAFT' && !!r.returnToDraftNote)
    .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));

  const drafts = runs
    .filter((r) => r.status === 'DRAFT' && !r.returnToDraftNote)
    .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));

  const handleLoad = (data: DraftLoadData) => {
    onLoad(data);
    onClose();
  };

  const isEmpty = recentApproved.length === 0 && returned.length === 0 && drafts.length === 0;

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Payroll History"
      description="Load values from a previous run into the payroll table."
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      ) : isEmpty ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-400">No payroll runs found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {recentApproved.length > 0 && (
            <div className="flex flex-col gap-3">
              <SectionHeader title="Recent Approved" count={recentApproved.length} />
              {recentApproved.map((run) => (
                <ApprovedRunCard key={run.id} run={run} onLoad={handleLoad} />
              ))}
            </div>
          )}

          {returned.length > 0 && (
            <div className="flex flex-col gap-3">
              <SectionHeader title="Rejected" count={returned.length} />
              {returned.map((run) => (
                <ReturnedRunCard key={run.id} run={run} onLoad={handleLoad} />
              ))}
            </div>
          )}

          {drafts.length > 0 && (
            <div className="flex flex-col gap-3">
              <SectionHeader title="Drafts" count={drafts.length} />
              {drafts.map((run) => (
                <DraftRunCard key={run.id} run={run} onLoad={handleLoad} />
              ))}
            </div>
          )}
        </div>
      )}
    </SidePanel>
  );
}
