'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { usePayrollRuns } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { PayrollRun, PayrollRunDetail } from '@/types/hr';
import { AllowanceItem } from '@/lib/payrollCalculations';
import { payrollMonthLabel } from '@/lib/payrollUtils';
import { api } from '@/lib/api';

function fmt(value: string | number) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface DraftLoadData {
  basicMap: Record<string, number>;
  allowancesMap: Record<string, AllowanceItem[]>;
  deductionsMap: Record<string, AllowanceItem[]>;
}

function DraftItem({ run, onLoad }: { run: PayrollRun; onLoad: (data: DraftLoadData) => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleUse = async () => {
    setLoading(true);
    try {
      const detail = await queryClient.fetchQuery<PayrollRunDetail>({
        queryKey: ['payroll', run.id],
        queryFn: async () => {
          const res = await api.get<PayrollRunDetail>(`/hr/payroll/${run.id}`);
          return res.data;
        },
      });

      const basicMap: Record<string, number> = {};
      const allowancesMap: Record<string, AllowanceItem[]> = {};
      const deductionsMap: Record<string, AllowanceItem[]> = {};

      for (const item of detail.items) {
        basicMap[item.employeeId] = parseFloat(item.basicSalary);
        const totalAllowances = parseFloat(item.totalAllowances);
        if (totalAllowances > 0) {
          allowancesMap[item.employeeId] = [{ name: 'Allowances', amount: totalAllowances }];
        }
        const otherDeductions = parseFloat(item.otherDeductions);
        if (otherDeductions > 0) {
          deductionsMap[item.employeeId] = [{ name: 'Other Deductions', amount: otherDeductions }];
        }
      }

      onLoad({ basicMap, allowancesMap, deductionsMap });
      toast.success(`${payrollMonthLabel(run.month, run.year)} loaded into payroll table`);
    } catch (err) {
      toast.error(extractError(err, 'Failed to load draft'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-100 bg-gray-50">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-gray-900">
          {payrollMonthLabel(run.month, run.year)}
        </p>
        <p className="text-xs text-gray-500">Total Gross: {fmt(run.totalGross)}</p>
        {run.notes && <p className="text-xs text-gray-400 italic truncate max-w-55">{run.notes}</p>}
      </div>
      <Button size="sm" onClick={handleUse} isLoading={loading} loadingText="Loading…">
        Use
      </Button>
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
  const drafts = runs.filter((r) => r.status === 'DRAFT');

  const handleLoad = (data: DraftLoadData) => {
    onLoad(data);
    onClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Draft Payrolls"
      description="Select a draft to load its values into the payroll table."
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-400">Loading drafts…</p>
        </div>
      ) : drafts.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-400">No draft payrolls found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {drafts.map((run) => (
            <DraftItem key={run.id} run={run} onLoad={handleLoad} />
          ))}
        </div>
      )}
    </SidePanel>
  );
}
