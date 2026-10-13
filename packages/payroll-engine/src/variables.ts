import type { PayComponent, VariableAmounts } from './types';

/** What an employee has on record that a variable component can take its amount from. */
export interface AllowanceRecord {
  type: string;
  name: string;
  amount: number;
}

export interface LoanRecord {
  totalAmount: number;
  monthlyRate: number;
  amountPaid: number;
  /** ISO date (or date-time) the loan starts being repaid from. */
  startDate: string;
}

const sum = (list: number[]) => list.reduce((total, n) => total + n, 0);

const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** The employee's allowances of the kind an allowance component pays. */
export function allowancesFor<T extends AllowanceRecord>(
  component: PayComponent,
  allowances: T[],
): T[] {
  const type = component.params.allowanceType;
  return allowances.filter(
    (a) => a.type === type && (type !== 'OTHER' || a.name === component.name),
  );
}

/** What a loan takes this month: the monthly rate, or what is left if that is less. */
export function loanRepayment(loan: LoanRecord): number {
  const balance = Math.max(0, loan.totalAmount - loan.amountPaid);
  return cents(Math.min(balance, loan.monthlyRate));
}

/** What the employee's loans take in total this month (loans that have started by `monthEnd`). */
export function loanRepayments(loans: LoanRecord[], monthEnd: string): number {
  return cents(sum(loans.filter((l) => l.startDate.slice(0, 10) <= monthEnd).map(loanRepayment)));
}

/**
 * The amounts for a configuration's variable components: allowances and loans come from the
 * employee's own records, and everything else from what was typed in for the run.
 */
export function variableAmounts(input: {
  components: PayComponent[];
  allowances: AllowanceRecord[];
  loans: LoanRecord[];
  /** Amounts typed in for this run, by component id. */
  runAmounts?: Record<string, number>;
  monthEnd: string;
}): VariableAmounts {
  const amounts: VariableAmounts = {};
  input.components
    .filter((c) => c.enabled && c.method === 'variable')
    .forEach((c) => {
      if (c.params.source === 'allowance') {
        amounts[c.id] = cents(sum(allowancesFor(c, input.allowances).map((a) => a.amount)));
      } else if (c.params.source === 'loans') {
        amounts[c.id] = loanRepayments(input.loans, input.monthEnd);
      } else {
        amounts[c.id] = input.runAmounts?.[c.id] ?? 0;
      }
    });
  return amounts;
}
