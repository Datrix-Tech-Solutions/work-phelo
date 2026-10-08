'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { api } from '@/lib/api';
import { PAYSLIP_TYPES, formatAmount, type PayslipTypeKey } from '@/lib/payroll-engine';
import { payrollMonthLabel } from '@/lib/payrollUtils';
import { useToast } from '@/hooks/useToast';
import type { PayrollRun, PayrollRunDetail } from '@/types/hr';
import type { RunFigures } from './runRows';

const n = (value?: string | null) => parseFloat(value || '0') || 0;

/** What was typed into a run, read back from its payslips so it can be worked on again. */
async function figuresFromRun(run: PayrollRun): Promise<RunFigures> {
  const { data } = await api.get<PayrollRunDetail>(`/hr/payroll/${run.id}`);
  const figures: RunFigures = { basic: {}, commission: {}, amounts: {} };
  for (const item of data.items) {
    figures.basic[item.employeeId] = n(item.basicSalary);
    figures.commission[item.employeeId] = n(item.commissionFigure);
    figures.amounts[item.employeeId] = Object.fromEntries(
      (item.lines ?? []).map((line) => [line.componentId, n(line.amount)]),
    );
  }
  return figures;
}

interface PayrollDraftsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Runs sent back to draft, newest first. */
  drafts: PayrollRun[];
  onLoad: (run: PayrollRun, figures: RunFigures) => void;
}

/** Runs the approver sent back, with their note, so the figures can be picked up and corrected. */
export function PayrollDraftsPanel({ isOpen, onClose, drafts, onLoad }: PayrollDraftsPanelProps) {
  const toast = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const load = async (run: PayrollRun) => {
    const key = run.payslipKey as PayslipTypeKey;
    setLoadingId(run.id);
    try {
      onLoad(run, await figuresFromRun(run));
      toast.success(`${PAYSLIP_TYPES[key].label} figures loaded. Review them and run again.`);
      onClose();
    } catch {
      toast.error('Could not load that draft');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Drafts"
      description="Payroll sent back for changes. Load one to correct its figures and run it again."
    >
      {drafts.length === 0 ? (
        <p className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
          No payroll has been sent back.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {drafts.map((run) => {
            const type = PAYSLIP_TYPES[run.payslipKey as PayslipTypeKey];
            return (
              <button
                key={run.id}
                type="button"
                disabled={loadingId !== null}
                onClick={() => void load(run)}
                className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-left transition-all hover:brightness-95 disabled:opacity-60"
              >
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {payrollMonthLabel(run.month, run.year)} · {type?.label ?? 'Payroll'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Gross: {formatAmount(n(run.totalGross), run.payrollCurrency)} · Net:{' '}
                      {formatAmount(n(run.totalNet), run.payrollCurrency)}
                    </p>
                    {run.returnToDraftNote && (
                      <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-600">
                        {run.returnToDraftNote}
                      </p>
                    )}
                    {loadingId === run.id && <p className="text-xs text-gray-400">Loading…</p>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </SidePanel>
  );
}
