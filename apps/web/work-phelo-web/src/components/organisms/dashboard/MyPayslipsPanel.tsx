'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';

interface Payslip {
  id: string;
  grossPay?: number | null;
  netPay?: number | null;
  payrollRun?: { year: number; month: number; status?: string };
}

interface MyPayslipsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  payslips: Payslip[];
}

export function MyPayslipsPanel({ isOpen, onClose, payslips }: MyPayslipsPanelProps) {
  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="My Payslips"
      description="Your recent payslip history."
      width="w-[480px]"
    >
      {payslips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <p className="text-sm text-gray-400">No payslips available yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {payslips.map((p) => {
            const run = p.payrollRun;
            const month = run
              ? new Date(run.year, run.month - 1).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })
              : '—';
            const gross = p.grossPay != null ? `GHS ${Number(p.grossPay).toFixed(2)}` : '—';
            const net = p.netPay != null ? `GHS ${Number(p.netPay).toFixed(2)}` : '—';
            const status = run?.status === 'PAID' ? 'Paid' : (run?.status ?? '—');
            return (
              <div
                key={p.id}
                className="flex items-center justify-between px-4 py-4 border border-gray-200 rounded-card bg-white"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{month}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Gross: {gross}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{net}</p>
                  <p className="text-xs text-green-600 font-medium">{status}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SidePanel>
  );
}
