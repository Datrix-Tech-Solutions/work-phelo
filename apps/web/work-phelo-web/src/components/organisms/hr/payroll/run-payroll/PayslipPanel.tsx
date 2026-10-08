'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { DeductionsPanel } from '@/components/organisms/hr/payroll/DeductionsPanel';
import { Button } from '@/components/atoms/Button';
import { NumberField } from '@/components/atoms/NumberField';
import { TypeChip } from '@/components/atoms/TypeChip';
import { cn } from '@/lib/utils';
import { ROLE_COLORS } from '@/components/organisms/hr/payroll/pay-components/roleColors';
import { useAddAllowance, useDeleteAllowance, useUpdateAllowance } from '@/hooks/hr/useEmployees';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import {
  INPUT_LABELS,
  PAYSLIP_TYPES,
  ROLE_LABELS,
  formatAmount,
  isDeductedFromPay,
  roleOf,
  type ComponentResult,
  type PayComponent,
} from '@/lib/payroll-engine';
import type { AllowanceType } from '@/types/hr';
import { allowancesFor, loanRepayments, type Row } from './runRows';

interface PayslipPanelProps {
  row: Row;
  currency: string;
  monthEnd: string;
  /** The figures typed in for this run can't change once it is with approval. */
  readOnly: boolean;
  commission: number;
  onCommission: (value: number) => void;
  amounts: Record<string, number>;
  onAmount: (componentId: string, value: number) => void;
  onClose: () => void;
}

function Line({
  component,
  label,
  amount,
  currency,
  strong,
}: {
  component?: PayComponent;
  label: string;
  amount: number;
  currency: string;
  strong?: boolean;
}) {
  const role = component ? roleOf(component) : undefined;
  return (
    <div
      className={cn('flex items-center justify-between gap-3 py-1.5', strong && 'font-semibold')}
    >
      <span className="flex min-w-0 items-center gap-2 text-sm text-gray-900">
        <span className="truncate">{label}</span>
        {role && <TypeChip label={ROLE_LABELS[role]} color={ROLE_COLORS[role]} />}
      </span>
      <span className="text-sm tabular-nums text-gray-900">{formatAmount(amount, currency)}</span>
    </div>
  );
}

/** A payslip, with the figures that can be changed: allowances, loans and this run's amounts. */
export function PayslipPanel({
  row,
  currency,
  monthEnd,
  readOnly,
  commission,
  onCommission,
  amounts,
  onAmount,
  onClose,
}: PayslipPanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { employee, group, configuration, result, components: all } = row;
  const type = PAYSLIP_TYPES[configuration.payslipType!];
  const components = all.filter((c) => c.enabled);

  const addAllowance = useAddAllowance(employee.id);
  const updateAllowance = useUpdateAllowance(employee.id);
  const deleteAllowance = useDeleteAllowance(employee.id);
  const [loansOpen, setLoansOpen] = useState(false);

  const allowanceComponents = components.filter(
    (c) => c.kind === 'earning' && c.method === 'variable' && c.params.source === 'allowance',
  );
  const hasLoans = components.some((c) => c.method === 'variable' && c.params.source === 'loans');
  const runAmounts = components.filter(
    (c) => c.method === 'variable' && (c.params.source ?? 'run') === 'run',
  );
  const earnings = components.filter((c) => c.kind === 'earning');
  const deductions = components.filter((c) => c.kind === 'deduction' && isDeductedFromPay(c));
  const employer = components.filter((c) => c.kind === 'employer');
  const loanTotal = loanRepayments(employee, monthEnd);

  const amountOf = (c: PayComponent) => {
    const r: ComponentResult | undefined = result?.byId.get(c.id);
    return r ? r.amount - r.relief : 0;
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['employees'] });

  /** Saves what was typed against the employee's own allowance records. */
  const saveAllowance = async (component: PayComponent, amount: number) => {
    const existing = allowancesFor(employee, component);
    const current = existing.reduce((sum, a) => sum + Number(a.amount), 0);
    if (amount === current || existing.length > 1) return;
    try {
      if (amount <= 0) {
        if (existing[0]) await deleteAllowance.mutateAsync(existing[0].id);
      } else if (existing[0]) {
        await updateAllowance.mutateAsync({ allowanceId: existing[0].id, payload: { amount } });
      } else {
        const allowanceType = component.params.allowanceType as AllowanceType;
        await addAllowance.mutateAsync({
          type: allowanceType,
          amount,
          ...(allowanceType === 'OTHER' ? { name: component.name } : {}),
        });
      }
      await refresh();
    } catch (e) {
      toast.error(extractError(e, 'Could not save the allowance'));
    }
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={`${employee.firstName} ${employee.lastName}`}
      description={`${group.name} · ${configuration.name}${row.version ? `, version ${row.version.version}` : ''}`}
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {type.inputs.map((input) =>
            input === 'basic' ? (
              <NumberField
                key={input}
                label={`${INPUT_LABELS.basic} (${currency}), from the employee record`}
                value={Number(employee.basicSalary) || 0}
                disabled
                onChange={() => undefined}
              />
            ) : (
              <NumberField
                key={input}
                label={`${INPUT_LABELS.commission} (${currency})`}
                value={commission}
                disabled={readOnly}
                onChange={onCommission}
              />
            ),
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Allowances</h3>
          {allowanceComponents.length === 0 ? (
            <p className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
              The configuration for {group.name} doesn&apos;t pay any allowances.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {allowanceComponents.map((c) => {
                  const records = allowancesFor(employee, c);
                  const total = records.reduce((sum, a) => sum + Number(a.amount), 0);
                  return (
                    <div key={c.id} className="flex flex-col gap-1">
                      <NumberField
                        label={`${c.name} (${currency})`}
                        value={total}
                        disabled={readOnly || records.length > 1}
                        onChange={() => undefined}
                        onBlur={(value) => void saveAllowance(c, value)}
                      />
                      {records.length > 1 && (
                        <span className="text-xs text-gray-500">
                          {employee.firstName} has {records.length} of these. Edit them on the
                          employee&apos;s profile.
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500">
                Only the allowances this group&apos;s configuration pays are listed. Leave one empty
                if {employee.firstName} isn&apos;t entitled to it. Changes are saved to the employee
                record.
              </p>
            </>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Loans</h3>
          {hasLoans ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {(employee.deductions ?? []).length === 0
                    ? 'No loans or deductions'
                    : `${(employee.deductions ?? []).length} loan${(employee.deductions ?? []).length === 1 ? '' : 's'}`}
                </p>
                <p className="text-xs text-gray-500">
                  This month&apos;s repayment: {formatAmount(loanTotal, currency)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setLoansOpen(true)}>
                Manage loans
              </Button>
            </div>
          ) : (
            <p className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
              The configuration for {group.name} doesn&apos;t take loan repayments.
            </p>
          )}
        </section>

        {runAmounts.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Other amounts for this run
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {runAmounts.map((c) => (
                <NumberField
                  key={c.id}
                  label={`${c.name} (${currency})`}
                  value={amounts[c.id] ?? 0}
                  disabled={readOnly}
                  onChange={(value) => onAmount(c.id, value)}
                />
              ))}
            </div>
          </section>
        )}

        {row.problem || !result ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {row.problem ?? 'This payslip could not be worked out.'}
          </p>
        ) : (
          <div className="rounded-lg border border-gray-200 px-4 py-2">
            <h3 className="pt-1 text-xs font-bold uppercase tracking-widest text-gray-500">
              Earnings
            </h3>
            {type.inputs.includes('basic') && (
              <Line
                label="Basic salary"
                amount={Number(employee.basicSalary) || 0}
                currency={currency}
              />
            )}
            {earnings.map((c) => (
              <Line
                key={c.id}
                component={c}
                label={c.name}
                amount={amountOf(c)}
                currency={currency}
              />
            ))}
            <Line label="Gross pay" amount={result.gross} currency={currency} strong />

            {deductions.length > 0 && (
              <>
                <h3 className="pt-3 text-xs font-bold uppercase tracking-widest text-gray-500">
                  Deductions
                </h3>
                {deductions.map((c) => (
                  <Line
                    key={c.id}
                    component={c}
                    label={c.name}
                    amount={amountOf(c)}
                    currency={currency}
                  />
                ))}
                <Line
                  label="Total deductions"
                  amount={result.totalDeductions}
                  currency={currency}
                  strong
                />
              </>
            )}

            <div className="my-3 border-y border-gray-200 py-3">
              <span className="block text-xs text-gray-500">Net pay</span>
              <div className="text-3xl font-bold tabular-nums text-(--module-btn-bg,var(--color-brand))">
                {formatAmount(result.net, currency)}
              </div>
              {result.shortfall > 0 && (
                <p className="mt-1 text-xs text-amber-800">
                  Deductions are {formatAmount(result.shortfall, currency)} more than pay, so net
                  pay is held at zero.
                </p>
              )}
            </div>

            {employer.length > 0 && (
              <>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">
                  Paid by the employer
                </h3>
                {employer.map((c) => (
                  <Line
                    key={c.id}
                    component={c}
                    label={c.name}
                    amount={amountOf(c)}
                    currency={currency}
                  />
                ))}
                <Line
                  label="Total employer cost"
                  amount={result.employerCost}
                  currency={currency}
                  strong
                />
              </>
            )}
          </div>
        )}

        <p className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600">
          The coloured tags are each line&apos;s accounting role. The Social security, Pension and
          Income tax pages are built from them.
        </p>
      </div>

      <DeductionsPanel
        isOpen={loansOpen}
        onClose={() => {
          setLoansOpen(false);
          void refresh();
        }}
        employeeId={employee.id}
        employeeName={`${employee.firstName} ${employee.lastName}`}
      />
    </SidePanel>
  );
}
