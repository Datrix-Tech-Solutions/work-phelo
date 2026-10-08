import { calculatePayslip } from './engine';
import { buildPayslipLines, lineRole, roleTotals, sumRoleTotals } from './payslip';
import { component, ghanaMonthly, paye, ssnitTier1, tier3Pension } from './payroll.fixtures';

const run = (components: ReturnType<typeof ghanaMonthly>, basic = 5000, variables = {}) => {
  const result = calculatePayslip(components, { basic, commission: 0 }, variables);
  const lines = buildPayslipLines(components, result);
  return { result, lines, totals: roleTotals(lines, result.gross) };
};

describe('payslip lines and role totals', () => {
  it('stores a line per component with its role', () => {
    const { lines } = run(ghanaMonthly(false), 5000, { transport: 300 });
    const byCode = Object.fromEntries(lines.map((l) => [l.code, l]));

    expect(lines).toHaveLength(5);
    expect(byCode.TRANSPORT).toMatchObject({ kind: 'earning', role: 'salary_wages', amount: 300 });
    expect(byCode.SSNIT_T1).toMatchObject({ role: 'employee_social_security', amount: 25 });
    expect(byCode.SSNIT_T2).toMatchObject({ role: 'employee_social_security', amount: 250 });
    expect(byCode.PAYE).toMatchObject({ role: 'income_tax', amount: 779.75 });
    expect(byCode.SSNIT_ER).toMatchObject({ kind: 'employer', role: 'employer_social_security' });
  });

  it('totals the lines by role, so it works for any configuration', () => {
    const { totals, result } = run(ghanaMonthly(false), 5000, { transport: 300 });
    expect(totals).toEqual({
      grossPay: 5300,
      employeeSocialSecurity: 275,
      pension: 0,
      incomeTax: 779.75,
      otherDeductions: 0,
      employerSocialSecurity: 650,
    });
    // Gross, less what is taken from pay, is net pay.
    expect(
      totals.grossPay -
        totals.employeeSocialSecurity -
        totals.pension -
        totals.incomeTax -
        totals.otherDeductions,
    ).toBe(result.net);
  });

  it('keeps Tier 3 apart from the social security that goes to SSNIT', () => {
    const { totals } = run([...ghanaMonthly(false), tier3Pension()], 5000, { transport: 300 });
    expect(totals.pension).toBe(250);
    expect(totals.employeeSocialSecurity).toBe(275);
  });

  it('takes tax credits off the deduction they reduce', () => {
    const credit = component({
      code: 'RELIEF',
      name: 'Personal relief',
      kind: 'credit',
      method: 'fixed',
      base: 'component',
      reduces: 'paye',
      baseComponentId: 'paye',
      params: { amount: 100 },
    });
    const { lines, totals } = run([ssnitTier1(), paye(), credit]);
    expect(lines.find((l) => l.code === 'PAYE')).toMatchObject({ amount: 842.25, relief: 100 });
    expect(lines.find((l) => l.code === 'RELIEF')).toMatchObject({ role: null, amount: 100 });
    expect(totals.incomeTax).toBe(742.25);
  });

  it('leaves out of the totals a deduction that is not taken from pay', () => {
    const relief = component({
      code: 'CRA',
      name: 'Consolidated relief',
      kind: 'deduction',
      method: 'fixed',
      params: { amount: 1000 },
      tags: { reducesTaxable: true, deductedFromPay: false },
    });
    const { lines, totals } = run([relief]);
    expect(lines[0]).toMatchObject({ takenFromPay: false, role: null });
    expect(totals.otherDeductions).toBe(0);
  });

  it('falls back to other deductions and employer social security when no role is chosen', () => {
    const deduction = { ...ssnitTier1(), role: undefined };
    const contribution = component({
      code: 'ER',
      name: 'Employer thing',
      kind: 'employer',
      method: 'fixed',
      role: undefined,
      params: { amount: 40 },
    });
    expect(lineRole(deduction)).toBe('other_deductions');
    expect(lineRole(contribution)).toBe('employer_social_security');
  });

  it('adds many payslips together', () => {
    const a = run(ghanaMonthly(false), 5000, { transport: 300 }).totals;
    const b = run(ghanaMonthly(false), 3000).totals;
    const total = sumRoleTotals([a, b]);
    expect(total.grossPay).toBe(a.grossPay + b.grossPay);
    expect(total.incomeTax).toBeCloseTo(a.incomeTax + b.incomeTax, 2);
  });
});
