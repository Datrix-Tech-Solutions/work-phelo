import { calculatePayslip } from './engine';
import { PayrollEngineError } from './types';
import {
  component,
  ghanaMonthly,
  paye,
  ssnitEmployer,
  ssnitTier1,
  ssnitTier2,
} from './payroll.fixtures';

const monthly = (basic: number, variables = {}) => ({
  basic,
  commission: 0,
  variables,
});
const run = (components: ReturnType<typeof ghanaMonthly>, basic: number, variables = {}) =>
  calculatePayslip(components, { basic, commission: 0 }, variables);

describe('Ghana monthly payroll', () => {
  it('works out SSNIT, PAYE and net pay with transport exempt from tax', () => {
    const r = run(ghanaMonthly(false), 5000, { transport: 300 });

    expect(r.byId.get('ssnit_t1')?.amount).toBe(25);
    expect(r.byId.get('ssnit_t2')?.amount).toBe(250);
    expect(r.taxable).toBe(4725);
    expect(r.byId.get('paye')?.amount).toBe(779.75);
    expect(r.gross).toBe(5300);
    expect(r.totalDeductions).toBe(1054.75);
    expect(r.net).toBe(4245.25);
    expect(r.byId.get('ssnit_er')?.amount).toBe(650);
    expect(r.employerCost).toBe(5950);
  });

  it('taxes transport when it is marked taxable', () => {
    const r = run(ghanaMonthly(true), 5000, { transport: 300 });
    expect(r.taxable).toBe(5025);
    expect(r.byId.get('paye')?.amount).toBe(854.75);
    expect(r.net).toBe(4170.25);
  });

  it('caps the SSNIT base at the insurable ceiling', () => {
    const r = run(ghanaMonthly(false), 100000);
    expect(r.byId.get('ssnit_t1')?.amount).toBe(345);
    expect(r.byId.get('ssnit_er')?.amount).toBe(8970);
  });
});

describe('commission', () => {
  const commissionEarning = (rate: number) =>
    component({
      code: 'COMM_EARN',
      name: 'Sales commission',
      kind: 'earning',
      method: 'percent',
      base: 'commission',
      params: { rate },
      tags: { taxable: true },
    });

  it('pays only what the commission figure produces', () => {
    const tax = component({
      code: 'COMM_TAX',
      name: 'Commission tax',
      kind: 'deduction',
      method: 'percent',
      role: 'income_tax',
      base: 'taxable_income',
      params: { rate: 10 },
    });
    const r = calculatePayslip([commissionEarning(10), tax], { basic: 0, commission: 10000 });

    expect(r.gross).toBe(1000);
    expect(r.byId.get('comm_tax')?.amount).toBe(100);
    expect(r.net).toBe(900);
  });

  it('combines salary and commission into one PAYE calculation', () => {
    const r = calculatePayslip([commissionEarning(10), ssnitTier1(), ssnitTier2(), paye()], {
      basic: 5000,
      commission: 10000,
    });
    expect(r.gross).toBe(6000);
    expect(r.taxable).toBe(5725);
    expect(r.byId.get('paye')?.amount).toBe(1029.75);
    expect(r.net).toBe(4695.25);
  });

  it('can tax commission separately at a flat rate', () => {
    const untaxedCommission = {
      ...commissionEarning(10),
      tags: { ...commissionEarning(10).tags, taxable: false },
    };
    const flat = component({
      code: 'COMM_TAX',
      name: 'Commission tax',
      kind: 'deduction',
      method: 'formula',
      role: 'income_tax',
      params: { expr: 'COMM_EARN * 0.10' },
    });
    const r = calculatePayslip([untaxedCommission, ssnitTier1(), ssnitTier2(), paye(), flat], {
      basic: 5000,
      commission: 10000,
    });
    expect(r.byId.get('paye')?.amount).toBe(779.75);
    expect(r.byId.get('comm_tax')?.amount).toBe(100);
    expect(r.net).toBe(4845.25);
  });
});

describe('Nigeria consolidated relief', () => {
  it('lowers taxable income without being deducted from pay', () => {
    const relief = component({
      code: 'CRA',
      name: 'Consolidated relief',
      kind: 'deduction',
      method: 'formula',
      params: { expr: 'max(200000 / 12, gross * 0.01) + gross * 0.2' },
      tags: { reducesTaxable: true, deductedFromPay: false },
    });
    const pension = component({
      code: 'PEN',
      name: 'Pension',
      kind: 'deduction',
      method: 'percent',
      role: 'pension',
      params: { rate: 8 },
      tags: { reducesTaxable: true },
    });
    const tax = component({
      code: 'PAYE',
      name: 'PAYE',
      kind: 'deduction',
      method: 'bands',
      role: 'income_tax',
      base: 'taxable_income',
      params: {
        period: 'annual',
        bands: [
          { upTo: 300000, rate: 7 },
          { upTo: 600000, rate: 11 },
          { upTo: 1100000, rate: 15 },
          { upTo: 1600000, rate: 19 },
          { upTo: 3200000, rate: 21 },
          { upTo: null, rate: 24 },
        ],
      },
    });
    const r = calculatePayslip([pension, relief, tax], { basic: 400000, commission: 0 });

    expect(r.byId.get('cra')?.amount).toBe(96666.67);
    expect(r.taxable).toBe(271333.33);
    expect(r.byId.get('paye')?.amount).toBe(47786.67);
    // The relief is not taken from pay, so only pension and PAYE reduce net.
    expect(r.totalDeductions).toBe(79786.67);
    expect(r.net).toBe(320213.33);
  });
});

describe('tax credits', () => {
  const credit = (amount: number, reduces = 'paye') =>
    component({
      code: `CREDIT_${amount}`,
      name: `Credit ${amount}`,
      kind: 'credit',
      method: 'fixed',
      base: 'component',
      reduces,
      baseComponentId: reduces,
      params: { amount },
    });

  it('takes a credit off its deduction but never below zero', () => {
    const r = run([ssnitTier1(), ssnitTier2(), paye(), credit(2400)], 5000);
    expect(r.byId.get('paye')?.relief).toBe(779.75);
    expect(r.byId.get('credit_2400')?.applied).toBe(779.75);
    expect(r.totalDeductions).toBe(275);
  });

  it('can be a share of another deduction', () => {
    const share = component({
      code: 'SSNIT_RELIEF',
      name: 'SSNIT relief',
      kind: 'credit',
      method: 'percent',
      base: 'component',
      reduces: 'paye',
      baseComponentId: 'ssnit_t2',
      params: { rate: 50 },
    });
    const r = run([ssnitTier1(), ssnitTier2(), paye(), share], 5000);
    expect(r.byId.get('ssnit_relief')?.amount).toBe(125);
    expect(r.byId.get('ssnit_relief')?.applied).toBe(125);
    expect(r.byId.get('paye')?.relief).toBe(125);
  });

  it('does not change taxable income', () => {
    const without = run([ssnitTier1(), ssnitTier2(), paye()], 5000);
    const withCredit = run([ssnitTier1(), ssnitTier2(), paye(), credit(100)], 5000);
    expect(withCredit.taxable).toBe(without.taxable);
  });
});

describe('variable amounts', () => {
  it('uses what was typed in, and zero when nothing was', () => {
    const overtime = component({
      code: 'OVERTIME',
      name: 'Overtime',
      kind: 'earning',
      method: 'variable',
      tags: { taxable: true },
    });
    const loan = component({
      code: 'LOANS',
      name: 'Loan repayment',
      kind: 'deduction',
      method: 'variable',
      role: 'other_deductions',
      params: { source: 'loans' },
    });
    const withValues = run([overtime, loan, ssnitTier1(), ssnitTier2()], 5000, {
      overtime: 400,
      loans: 300,
    });
    expect(withValues.gross).toBe(5400);
    expect(withValues.taxable).toBe(5125);
    expect(withValues.net).toBe(4825);

    expect(run([overtime, loan], 5000).gross).toBe(5000);
  });
});

describe('net pay', () => {
  it('is held at zero when deductions are more than pay', () => {
    const loan = component({
      code: 'LOANS',
      name: 'Loan',
      kind: 'deduction',
      method: 'variable',
      role: 'other_deductions',
    });
    const r = run([loan], 1000, { loans: 1500 });
    expect(r.net).toBe(0);
    expect(r.shortfall).toBe(500);
    expect(r.totalDeductions).toBe(1500);
  });

  it('leaves out components that are switched off', () => {
    const off = { ...ssnitTier1(), enabled: false };
    expect(run([off], 5000).totalDeductions).toBe(0);
  });
});

describe('totals', () => {
  it('are free of floating-point noise', () => {
    const r = run(ghanaMonthly(false), 5000, { transport: 300 });
    [r.gross, r.net, r.totalDeductions, r.employerCost, r.taxable].forEach((n) =>
      expect(n).toBe(Math.round(n * 100) / 100),
    );
  });
});

describe('errors', () => {
  it('reports components that depend on each other in a loop', () => {
    const a = component({
      code: 'A',
      name: 'A',
      kind: 'deduction',
      method: 'formula',
      params: { expr: 'B + 1' },
    });
    const b = component({
      code: 'B',
      name: 'B',
      kind: 'deduction',
      method: 'formula',
      params: { expr: 'A + 1' },
    });
    expect(() => run([a, b], 1000)).toThrow(/depend on each other in a loop/);
  });

  it("won't calculate an earning on pay that includes itself", () => {
    const bad = component({
      code: 'BAD',
      name: 'Bad',
      kind: 'earning',
      method: 'percent',
      base: 'gross',
      params: { rate: 10 },
    });
    expect(() => run([bad], 1000)).toThrow(PayrollEngineError);
  });

  it("won't let a taxable-income reducer be calculated on taxable income", () => {
    const bad = { ...paye(), tags: { ...paye().tags, reducesTaxable: true } };
    expect(() => run([bad], 1000)).toThrow(/reduces taxable income/);
  });

  it('names an unknown name in a formula', () => {
    const f = component({
      code: 'F',
      name: 'F',
      kind: 'deduction',
      method: 'formula',
      params: { expr: 'nothing * 2' },
    });
    expect(() => run([f], 1000)).toThrow(/Unknown name/);
  });
});

describe('employer cost', () => {
  it('is gross pay plus employer contributions', () => {
    const r = run([ssnitEmployer()], 5000);
    expect(r.totalEmployer).toBe(650);
    expect(r.employerCost).toBe(5650);
  });
});

void monthly;
