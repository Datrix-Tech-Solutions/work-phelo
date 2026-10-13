import { DEFAULT_ROLE } from './constants';
import { isDeductedFromPay } from './engine';
import type { PayComponent, PayRole, PayslipResult } from './types';

/**
 * A payslip as it is stored: one line per component that took part, each carrying the accounting
 * role it posts to. This is what lets one table hold any payroll configuration.
 */
export interface PayslipLine {
  componentId: string;
  code: string;
  name: string;
  kind: PayComponent['kind'];
  /** The accounting role. Credits have none: they lower the deduction they reduce. */
  role: PayRole | null;
  /** What the component came to, before any tax credit was taken off it. */
  amount: number;
  /** Tax credits taken off this deduction (deductions only). */
  relief: number;
  /** False for a deduction that only lowers taxable income and is not taken from pay. */
  takenFromPay: boolean;
}

/** The totals accounting posts, one per role. Net pay is worked out, so it is not a role. */
export interface RoleTotals {
  grossPay: number;
  employeeSocialSecurity: number;
  pension: number;
  incomeTax: number;
  otherDeductions: number;
  employerSocialSecurity: number;
}

const tidy = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** The role a component posts to; a deduction or contribution with none chosen falls back. */
export function lineRole(component: PayComponent): PayRole | null {
  if (component.kind === 'credit') return null;
  if (component.kind === 'deduction' && !isDeductedFromPay(component)) return null;
  if (component.kind === 'deduction') return component.role ?? 'other_deductions';
  return component.role ?? DEFAULT_ROLE[component.kind] ?? null;
}

/** The lines of a worked-out payslip, in the order the components were set up. */
export function buildPayslipLines(
  components: PayComponent[],
  result: PayslipResult,
): PayslipLine[] {
  return components
    .filter((c) => c.enabled && result.byId.has(c.id))
    .map((c) => {
      const r = result.byId.get(c.id)!;
      return {
        componentId: c.id,
        code: c.code,
        name: c.name,
        kind: c.kind,
        role: lineRole(c),
        amount: r.amount,
        relief: c.kind === 'deduction' ? r.relief : 0,
        takenFromPay: c.kind !== 'deduction' || isDeductedFromPay(c),
      };
    });
}

/** Adds the lines up by role, with tax credits already taken off the deduction they reduce. */
export function roleTotals(lines: PayslipLine[], grossPay: number): RoleTotals {
  const totals: RoleTotals = {
    grossPay: tidy(grossPay),
    employeeSocialSecurity: 0,
    pension: 0,
    incomeTax: 0,
    otherDeductions: 0,
    employerSocialSecurity: 0,
  };
  const add = (role: PayRole | null, amount: number) => {
    if (role === 'employee_social_security') totals.employeeSocialSecurity += amount;
    else if (role === 'pension') totals.pension += amount;
    else if (role === 'income_tax') totals.incomeTax += amount;
    else if (role === 'other_deductions') totals.otherDeductions += amount;
    else if (role === 'employer_social_security') totals.employerSocialSecurity += amount;
  };
  lines.forEach((line) => {
    if (line.kind === 'deduction' && line.takenFromPay) add(line.role, line.amount - line.relief);
    else if (line.kind === 'employer') add(line.role, line.amount);
  });
  return {
    grossPay: totals.grossPay,
    employeeSocialSecurity: tidy(totals.employeeSocialSecurity),
    pension: tidy(totals.pension),
    incomeTax: tidy(totals.incomeTax),
    otherDeductions: tidy(totals.otherDeductions),
    employerSocialSecurity: tidy(totals.employerSocialSecurity),
  };
}

/** Adds up the role totals of many payslips. */
export function sumRoleTotals(list: RoleTotals[]): RoleTotals {
  const sum = (pick: (t: RoleTotals) => number) => tidy(list.reduce((s, t) => s + pick(t), 0));
  return {
    grossPay: sum((t) => t.grossPay),
    employeeSocialSecurity: sum((t) => t.employeeSocialSecurity),
    pension: sum((t) => t.pension),
    incomeTax: sum((t) => t.incomeTax),
    otherDeductions: sum((t) => t.otherDeductions),
    employerSocialSecurity: sum((t) => t.employerSocialSecurity),
  };
}
