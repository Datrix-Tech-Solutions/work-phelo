// GENERATED from packages/payroll-engine/src/validation.ts by scripts/sync-payroll-engine.mjs.
// Do not edit this copy. Change the package, then run: npm run sync:payroll-engine

import {
  ALLOWANCE_TYPES,
  BASE_LABELS,
  DEFAULT_ROLE,
  PAYSLIP_TYPES,
  REQUIRED_ROLES,
  RESERVED_CODES,
  ROLE_LABELS,
} from './constants';
import { calculatePayslip, isDeductedFromPay } from './engine';
import { formulaRefs } from './formula';
import {
  PayrollEngineError,
  type PayComponent,
  type PayInput,
  type PayRole,
  type PayslipTypeKey,
} from './types';

export interface ConfigurationCheck {
  /** Stop the configuration being saved for this payslip type. */
  errors: string[];
  /** Worth knowing, but it can still be saved. */
  warnings: string[];
  /** Friendly nudges about things left out. They never block or change anything. */
  reminders: string[];
}

const INPUTS: PayInput[] = ['basic', 'commission'];

/** The role a component represents. Credits follow their deduction, so they are never counted here. */
export function roleOf(c: PayComponent): PayRole | undefined {
  if (c.kind === 'deduction' && !isDeductedFromPay(c)) return undefined;
  return c.role ?? DEFAULT_ROLE[c.kind];
}

/** Roles a payslip type needs for accounting that no component carries, and components still without a role. */
export function checkRoles(components: PayComponent[], typeKey: PayslipTypeKey): string[] {
  const enabled = components.filter((c) => c.enabled);
  const carried = new Set(enabled.map(roleOf));
  // A payslip type with a basic salary already pays Salary and wages through it, even if no
  // earning component is added on top.
  if (PAYSLIP_TYPES[typeKey].inputs.includes('basic')) carried.add('salary_wages');
  const messages: string[] = [];

  enabled
    .filter((c) => c.kind === 'deduction' && isDeductedFromPay(c) && !roleOf(c))
    .forEach((c) => messages.push(`"${c.name}" has no accounting role yet.`));

  REQUIRED_ROLES[typeKey]
    .filter((role) => !carried.has(role))
    .forEach((role) =>
      messages.push(
        `${ROLE_LABELS[role]} isn't assigned to any component, so ${PAYSLIP_TYPES[typeKey].label} payroll can't be linked to accounting.`,
      ),
    );
  return messages;
}

/** The optional parts of a configuration, which are easy to forget. */
const OPTIONAL_ROLES: PayRole[] = [
  'income_tax',
  'employee_social_security',
  'employer_social_security',
  'pension',
  'other_deductions',
];

/** A gentle nudge about optional parts that aren't set up. It never blocks or changes anything. */
export function checkReminders(components: PayComponent[]): string[] {
  const carried = new Set(components.filter((c) => c.enabled).map(roleOf));
  const missing = OPTIONAL_ROLES.filter((role) => !carried.has(role));
  if (!missing.length) return [];
  return [
    `Not set up yet: ${missing.map((role) => ROLE_LABELS[role]).join(', ')}. These are optional, so add any you need, such as tax, social security or loans. This is only a reminder.`,
  ];
}

/** The typed-in figures a component is calculated from. */
export function inputsUsedBy(c: PayComponent): PayInput[] {
  if (c.method === 'percent' || c.method === 'bands') {
    return INPUTS.filter((i) => i === c.base);
  }
  if (c.method === 'formula') {
    const refs = formulaRefs(c.params.expr);
    return INPUTS.filter((i) => refs.includes(i));
  }
  return [];
}

interface CreditIssue {
  message: string;
  blocking: boolean;
}

/** Tax credits must point at an employee deduction, and be calculated on one when they use a rate. */
export function checkCredits(components: PayComponent[]): CreditIssue[] {
  const issues: CreditIssue[] = [];
  const deduction = (id: string | undefined) =>
    components.find((x) => x.id === id && x.kind === 'deduction');

  components
    .filter((c) => c.kind === 'credit' && c.enabled)
    .forEach((c) => {
      const target = deduction(c.reduces);
      if (!target) {
        issues.push({ message: `Choose which deduction "${c.name}" reduces.`, blocking: true });
      } else if (!isDeductedFromPay(target)) {
        issues.push({
          message: `"${c.name}" reduces "${target.name}", which isn't deducted from pay, so there is nothing to reduce.`,
          blocking: true,
        });
      } else if (!target.enabled) {
        issues.push({
          message: `"${c.name}" reduces "${target.name}", which is switched off, so it does nothing.`,
          blocking: false,
        });
      }
      if ((c.method === 'percent' || c.method === 'bands') && c.base === 'component') {
        const base = deduction(c.baseComponentId);
        if (!base) {
          issues.push({
            message: `Choose which deduction "${c.name}" is calculated on.`,
            blocking: true,
          });
        } else if (!base.enabled) {
          issues.push({
            message: `"${c.name}" is calculated on "${base.name}", which is switched off, so it comes out as 0.`,
            blocking: false,
          });
        }
      }
    });
  return issues;
}

/** Whether a configuration fits a payslip type, so a payslip can never silently come out as zero. */
export function checkConfiguration(
  components: PayComponent[],
  typeKey: PayslipTypeKey,
): ConfigurationCheck {
  const type = PAYSLIP_TYPES[typeKey];
  const enabled = components.filter((c) => c.enabled);
  const errors: string[] = [];
  const warnings: string[] = [];

  enabled.forEach((c) => {
    if (c.kind === 'deduction' && !isDeductedFromPay(c) && !c.tags.reducesTaxable) {
      warnings.push(
        `"${c.name}" is neither deducted from pay nor reduces taxable income, so it has no effect.`,
      );
    }
    inputsUsedBy(c)
      .filter((input) => !type.inputs.includes(input))
      .forEach((input) => {
        warnings.push(
          `"${c.name}" is calculated on the ${BASE_LABELS[input]}, which ${type.label} payslips don't have.`,
        );
      });
  });

  const allowanceTaken = new Map<string, string>();
  enabled
    .filter((c) => c.method === 'variable' && c.params.source === 'allowance')
    .forEach((c) => {
      const allowance = c.params.allowanceType;
      if (!allowance) {
        errors.push(`Choose which allowance type "${c.name}" takes.`);
        return;
      }
      const label = ALLOWANCE_TYPES.find((a) => a.value === allowance)?.label ?? allowance;
      const other = allowanceTaken.get(allowance);
      if (other) {
        warnings.push(
          `"${c.name}" and "${other}" both take the ${label.toLowerCase()} allowance, so it would be paid twice.`,
        );
      }
      allowanceTaken.set(allowance, c.name);
    });

  // The server refuses these too, so they stop the save here instead of failing there.
  components.forEach((c) => {
    if (!c.name.trim()) errors.push('A component has no name.');
    if (!c.code.trim()) errors.push(`"${c.name || 'A component'}" has no code.`);
    const rates = [c.params.rate, ...(c.params.bands ?? []).map((b) => b.rate)];
    if (rates.some((r) => r != null && (r < 0 || r > 100))) {
      errors.push(`"${c.name}": a rate must be from 0 to 100.`);
    }
    const amounts = [c.params.amount, c.params.baseCap, c.params.min, c.params.max];
    if (amounts.some((a) => a != null && a < 0)) {
      errors.push(`"${c.name}": amounts can't be negative.`);
    }
  });

  const codes = new Map<string, string>();
  components.forEach((c) => {
    if ((RESERVED_CODES as readonly string[]).includes(c.code.toUpperCase())) {
      errors.push(
        `"${c.name}": the code ${c.code} is reserved for a built-in figure in formulas. Use another code, such as ${c.code}_EARN.`,
      );
    }
    const code = c.code.toLowerCase();
    if (codes.has(code)) {
      errors.push(`"${c.name}" and "${codes.get(code)}" both use the code ${c.code}.`);
    }
    codes.set(code, c.name);
  });
  components
    .filter((c) => c.method === 'bands')
    .forEach((c) => {
      const bands = c.params.bands ?? [];
      const outOfOrder = bands.some(
        (band, i) =>
          i > 0 &&
          band.upTo !== null &&
          bands[i - 1].upTo !== null &&
          band.upTo <= (bands[i - 1].upTo ?? 0),
      );
      if (outOfOrder) {
        errors.push(`"${c.name}": band limits must go up from top to bottom.`);
      }
    });

  checkCredits(components).forEach((issue) =>
    (issue.blocking ? errors : warnings).push(issue.message),
  );

  if (
    type.inputs.includes('commission') &&
    !enabled.some((c) => inputsUsedBy(c).includes('commission'))
  ) {
    const message =
      'Nothing uses the commission figure yet. Add an earning calculated on it, for example your commission rate.';
    (type.inputs.includes('basic') ? warnings : errors).push(message);
  }

  warnings.push(...checkRoles(components, typeKey));

  try {
    calculatePayslip(components, { basic: 0, commission: 0 });
  } catch (e) {
    if (e instanceof PayrollEngineError) errors.push(e.message);
    else throw e;
  }

  return { errors, warnings, reminders: checkReminders(components) };
}
