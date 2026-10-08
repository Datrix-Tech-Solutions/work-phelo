import type {
  CalcMethod,
  ComponentKind,
  ComponentParams,
  PayBase,
  PayInput,
  PayRole,
  PayslipTypeKey,
  VariableSource,
} from './types';

export const BASE_LABELS: Record<PayBase, string> = {
  basic: 'basic salary',
  commission: 'commission figure',
  gross: 'gross pay',
  pensionable: 'pensionable pay',
  taxable_income: 'taxable income',
  component: 'a deduction',
};

export const KIND_LABELS: Record<ComponentKind, string> = {
  earning: 'Earnings',
  deduction: 'Employee deductions',
  employer: 'Employer contributions',
  credit: 'Tax credits',
};

export const KIND_ORDER: ComponentKind[] = ['earning', 'deduction', 'credit', 'employer'];

export const METHODS: Record<
  CalcMethod,
  { label: string; description: string; kinds: ComponentKind[] }
> = {
  fixed: {
    label: 'Fixed amount',
    description: 'The same amount every period.',
    kinds: ['earning', 'deduction', 'credit', 'employer'],
  },
  percent: {
    label: 'Percentage',
    description: 'A rate on pay, with optional limits.',
    kinds: ['earning', 'deduction', 'credit', 'employer'],
  },
  bands: {
    label: 'Progressive bands',
    description: 'Each slice of income is taxed at its own rate.',
    kinds: ['deduction', 'credit', 'employer'],
  },
  variable: {
    label: 'Variable',
    description: 'Entered each payroll run, such as overtime or a loan repayment.',
    kinds: ['earning', 'deduction', 'credit', 'employer'],
  },
  formula: {
    label: 'Formula',
    description: 'Your own calculation.',
    kinds: ['earning', 'deduction', 'credit', 'employer'],
  },
};

export const DEFAULT_PARAMS: Record<CalcMethod, () => ComponentParams> = {
  fixed: () => ({ amount: 0 }),
  percent: () => ({ rate: 0, baseCap: null, min: null, max: null }),
  bands: () => ({
    period: 'monthly',
    bands: [
      { upTo: 1000, rate: 0 },
      { upTo: null, rate: 10 },
    ],
  }),
  formula: () => ({ expr: 'basic * 0.05' }),
  variable: () => ({}),
};

/** What the person picks first when adding a component. */
export interface ComponentTemplate {
  kind: ComponentKind;
  method: CalcMethod;
  title: string;
  description: string;
}

export const ADD_OPTIONS: ComponentTemplate[] = [
  {
    kind: 'earning',
    method: 'fixed',
    title: 'Earning',
    description: 'Adds to gross pay, such as a transport or housing allowance.',
  },
  {
    kind: 'deduction',
    method: 'percent',
    title: 'Employee deduction',
    description: 'Taken from the employee, such as a pension contribution, tax or union dues.',
  },
  {
    kind: 'credit',
    method: 'fixed',
    title: 'Tax credit',
    description: 'Reduces an employee deduction, such as a personal relief taken off PAYE.',
  },
  {
    kind: 'employer',
    method: 'percent',
    title: 'Employer contribution',
    description: 'Paid by the employer on top of pay. Does not reduce net pay.',
  },
];

export const ROUNDING_OPTIONS = [
  { value: 'cent', label: 'Nearest 2 decimal places' },
  { value: 'whole', label: 'Nearest whole number' },
  { value: 'down', label: 'Down to 2 decimal places' },
  { value: 'none', label: 'No rounding' },
] as const;

/** What the person types in for each input, on the sample payslip. */
export const INPUT_LABELS: Record<PayInput, string> = {
  basic: 'Basic salary',
  commission: 'Commission basis',
};

export interface PayslipType {
  key: PayslipTypeKey;
  label: string;
  description: string;
  /** The figures this payslip type is calculated from. */
  inputs: PayInput[];
}

export const PAYSLIP_TYPES: Record<PayslipTypeKey, PayslipType> = {
  monthly: {
    key: 'monthly',
    label: 'Salary',
    description: 'Paid a basic salary.',
    inputs: ['basic'],
  },
  commission: {
    key: 'commission',
    label: 'Commission',
    description: 'Paid from a commission figure, such as sales.',
    inputs: ['commission'],
  },
  monthly_commission: {
    key: 'monthly_commission',
    label: 'Salary + Commission',
    description: 'Paid a basic salary and commission.',
    inputs: ['basic', 'commission'],
  },
};

export const PAYSLIP_TYPE_ORDER: PayslipTypeKey[] = ['monthly', 'commission', 'monthly_commission'];

export const ROLE_LABELS: Record<PayRole, string> = {
  salary_wages: 'Salary and wages',
  employee_social_security: 'Employee social security',
  income_tax: 'Income tax',
  employer_social_security: 'Employer social security',
  pension: 'Pension',
  other_deductions: 'Other deductions',
  tax_credit: 'Tax credit',
};

/** The roles a component of each type can represent. */
export const ROLES_BY_KIND: Record<ComponentKind, PayRole[]> = {
  earning: ['salary_wages'],
  deduction: ['employee_social_security', 'income_tax', 'pension', 'other_deductions'],
  credit: ['tax_credit'],
  employer: ['employer_social_security'],
};

/** Types with a single possible role get it automatically; a deduction has to be chosen. */
export const DEFAULT_ROLE: Partial<Record<ComponentKind, PayRole>> = {
  earning: 'salary_wages',
  credit: 'tax_credit',
  employer: 'employer_social_security',
};

/**
 * What payroll needs to post to accounting. Only pay is required, for every payslip type: a basic
 * salary covers it, and a commission payslip needs an earning built from the commission figure.
 * Income tax, social security, pension and other deductions are posted only when a configuration
 * has them, so a configuration can leave them out (an exempt contractor, say). Net pay is worked
 * out, so it is never a role.
 */
export const REQUIRED_ROLES: Record<PayslipTypeKey, PayRole[]> = {
  monthly: ['salary_wages'],
  commission: ['salary_wages'],
  monthly_commission: ['salary_wages'],
};

export const VARIABLE_SOURCE_LABELS: Record<VariableSource, string> = {
  run: 'Typed each run',
  allowance: 'Employee allowances',
  loans: 'Employee loans and deductions',
};

/** Where a variable component of each type can start its amount from. */
export const VARIABLE_SOURCES_BY_KIND: Record<ComponentKind, VariableSource[]> = {
  earning: ['run', 'allowance'],
  deduction: ['run', 'loans'],
  credit: ['run'],
  employer: ['run'],
};

/** The allowance types an employee can have, matching the employee record. */
export const ALLOWANCE_TYPES = [
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'HOUSING', label: 'Housing' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'CLOTHING', label: 'Clothing' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Names a formula reads as built-in figures, so no component may use them as its code: a component
 * called COMMISSION would otherwise be read as the commission figure instead.
 */
export const RESERVED_CODES = ['BASIC', 'COMMISSION', 'GROSS', 'PENSIONABLE', 'TAXABLE'] as const;

/** How an employee is paid, as recorded on the employee. */
export type CompensationType = 'SALARY' | 'COMMISSION' | 'SALARY_PLUS_COMMISSION';

/**
 * The payslip type each compensation type is paid through, which decides which payroll groups an
 * employee can be placed in: a group's configuration has one payslip type.
 */
export const COMPENSATION_PAYSLIP_TYPE: Record<CompensationType, PayslipTypeKey> = {
  SALARY: 'monthly',
  COMMISSION: 'commission',
  SALARY_PLUS_COMMISSION: 'monthly_commission',
};
