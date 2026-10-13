import { loanRepayment, loanRepayments, variableAmounts } from './variables';
import { component } from './payroll.fixtures';

const transport = component({
  code: 'TRANSPORT',
  name: 'Transport',
  kind: 'earning',
  method: 'variable',
  params: { source: 'allowance', allowanceType: 'TRANSPORT' },
});
const other = component({
  code: 'MEAL',
  name: 'Meal',
  kind: 'earning',
  method: 'variable',
  params: { source: 'allowance', allowanceType: 'OTHER' },
});
const loans = component({
  code: 'LOANS',
  name: 'Loans',
  kind: 'deduction',
  method: 'variable',
  params: { source: 'loans' },
});
const overtime = component({
  code: 'OVERTIME',
  name: 'Overtime',
  kind: 'earning',
  method: 'variable',
});

const loan = (over = {}) => ({
  totalAmount: 4800,
  monthlyRate: 400,
  amountPaid: 1600,
  startDate: '2026-06-01',
  ...over,
});

describe('variable amounts', () => {
  it('takes allowances from the employee records, matched by type', () => {
    const result = variableAmounts({
      components: [transport],
      allowances: [
        { type: 'TRANSPORT', name: 'Transport', amount: 300 },
        { type: 'HOUSING', name: 'Housing', amount: 500 },
      ],
      loans: [],
      monthEnd: '2026-10-31',
    });
    expect(result).toEqual({ transport: 300 });
  });

  it('matches an Other allowance by its name', () => {
    const result = variableAmounts({
      components: [other],
      allowances: [
        { type: 'OTHER', name: 'Meal', amount: 120 },
        { type: 'OTHER', name: 'Phone', amount: 80 },
      ],
      loans: [],
      monthEnd: '2026-10-31',
    });
    expect(result).toEqual({ meal: 120 });
  });

  it('is zero for an allowance the employee does not have', () => {
    expect(
      variableAmounts({
        components: [transport],
        allowances: [],
        loans: [],
        monthEnd: '2026-10-31',
      }),
    ).toEqual({ transport: 0 });
  });

  it('takes loan repayments from the employee loans', () => {
    const result = variableAmounts({
      components: [loans],
      allowances: [],
      loans: [loan(), loan({ totalAmount: 100, monthlyRate: 50, amountPaid: 80 })],
      monthEnd: '2026-10-31',
    });
    // 400 for the first, and only the 20 left on the second.
    expect(result).toEqual({ loans: 420 });
  });

  it('ignores a loan that has not started yet or is paid off', () => {
    expect(loanRepayments([loan({ startDate: '2026-12-01' })], '2026-10-31')).toBe(0);
    expect(loanRepayments([loan({ amountPaid: 4800 })], '2026-10-31')).toBe(0);
  });

  it('takes everything else from what was typed in for the run', () => {
    const result = variableAmounts({
      components: [overtime],
      allowances: [],
      loans: [],
      runAmounts: { overtime: 250 },
      monthEnd: '2026-10-31',
    });
    expect(result).toEqual({ overtime: 250 });
  });

  it('skips switched-off components', () => {
    const off = { ...overtime, enabled: false };
    expect(
      variableAmounts({ components: [off], allowances: [], loans: [], monthEnd: '2026-10-31' }),
    ).toEqual({});
  });

  it('works out one loan repayment', () => {
    expect(loanRepayment(loan())).toBe(400);
    expect(loanRepayment(loan({ amountPaid: 4650 }))).toBe(150);
  });
});
