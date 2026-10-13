'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { TypeChip } from '@/components/atoms/TypeChip';
import { cn } from '@/lib/utils';
import { ROLE_COLORS } from '@/components/organisms/hr/payroll/pay-components/roleColors';
import { ROLE_LABELS, formatAmount, type PayRole } from '@/lib/payroll-engine';
import type { PayrollItem, PayrollItemLine } from '@/types/hr';

function Line({
  line,
  amount,
  currency,
  strong,
  label,
}: {
  line?: PayrollItemLine;
  amount: number;
  currency: string;
  strong?: boolean;
  label?: string;
}) {
  const role = line?.role as PayRole | null | undefined;
  return (
    <div
      className={cn('flex items-center justify-between gap-3 py-1.5', strong && 'font-semibold')}
    >
      <span className="flex min-w-0 items-center gap-2 text-sm text-gray-900">
        <span className="truncate">{label ?? line?.name}</span>
        {role && ROLE_LABELS[role] && (
          <TypeChip label={ROLE_LABELS[role]} color={ROLE_COLORS[role]} />
        )}
      </span>
      <span className="text-sm tabular-nums text-gray-900">{formatAmount(amount, currency)}</span>
    </div>
  );
}

/** A stored payslip, read-only: its lines as they were worked out when payroll was run. */
export function StoredPayslipPanel({
  item,
  currency,
  onClose,
}: {
  item: PayrollItem;
  currency: string;
  onClose: () => void;
}) {
  const lines = [...(item.lines ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const n = (value: string | undefined | null) => Number(value ?? 0);
  const earnings = lines.filter((l) => l.kind === 'earning');
  const deductions = lines.filter((l) => l.kind === 'deduction' && l.takenFromPay);
  const credits = lines.filter((l) => l.kind === 'credit');
  const employer = lines.filter((l) => l.kind === 'employer');
  const name = item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : 'Payslip';

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={name}
      description={
        item.configurationVersion
          ? `Worked out with version ${item.configurationVersion} of its configuration`
          : undefined
      }
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-gray-200 px-4 py-2">
          <h3 className="pt-1 text-xs font-bold uppercase tracking-widest text-gray-500">
            Earnings
          </h3>
          {n(item.basicSalary) > 0 && (
            <Line label="Basic salary" amount={n(item.basicSalary)} currency={currency} />
          )}
          {earnings.map((l) => (
            <Line key={l.id} line={l} amount={n(l.amount)} currency={currency} />
          ))}
          <Line label="Gross pay" amount={n(item.grossSalary)} currency={currency} strong />

          {deductions.length > 0 && (
            <>
              <h3 className="pt-3 text-xs font-bold uppercase tracking-widest text-gray-500">
                Deductions
              </h3>
              {deductions.map((l) => (
                <Line key={l.id} line={l} amount={n(l.amount) - n(l.relief)} currency={currency} />
              ))}
              <Line
                label="Total deductions"
                amount={n(item.totalDeductions)}
                currency={currency}
                strong
              />
            </>
          )}

          <div className="my-3 border-y border-gray-200 py-3">
            <span className="block text-xs text-gray-500">Net pay</span>
            <div className="text-3xl font-bold tabular-nums text-(--module-btn-bg,var(--color-brand))">
              {formatAmount(n(item.netSalary), currency)}
            </div>
          </div>

          {credits.length > 0 && (
            <>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">
                Tax credits applied
              </h3>
              {credits.map((l) => (
                <Line key={l.id} line={l} amount={n(l.amount)} currency={currency} />
              ))}
              <p className="pb-2 text-xs text-gray-500">
                Already taken off the deduction they reduce.
              </p>
            </>
          )}

          {employer.length > 0 && (
            <>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">
                Paid by the employer
              </h3>
              {employer.map((l) => (
                <Line key={l.id} line={l} amount={n(l.amount)} currency={currency} />
              ))}
            </>
          )}
        </div>
      </div>
    </SidePanel>
  );
}
