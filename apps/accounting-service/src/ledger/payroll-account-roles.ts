import { GLAccountCategory } from '../../prisma/generated/client';

/** Every account payroll posts to, by the job it does. The accountant maps each to one of the tenant's own accounts. */
export type PayrollAccountRole =
  | 'salariesWagesExpense'
  | 'employerSocialSecurityExpense'
  | 'netPayPayable'
  | 'incomeTaxPayable'
  | 'socialSecurityPayable'
  | 'statutoryPensionPayable'
  | 'otherDeductionsPayable';

export interface PayrollAccountRoleDefinition {
  key: PayrollAccountRole;
  label: string;
  description: string;
  /** The kind of account that can do this job. */
  category: GLAccountCategory;
  /**
   * Every payroll run has an amount for it, so payroll cannot be linked without it. Only pay itself
   * and what is owed to employees are core: payroll configurations are set up by the tenant, so
   * tax, social security, pension and other deductions exist only when a configuration has them.
   * Posting skips a function whose amount is zero, and asks for its account only once it has one.
   */
  core: boolean;
  /** Raises its own open item to settle (a liability), rather than being an expense. */
  isLiability: boolean;
  /** What the standard-accounts shortcut calls the account it creates for this job. */
  standardName: string;
  /** The seed item key this role corresponds to. */
  seedKey: string;
}

export const PAYROLL_ACCOUNT_ROLES: PayrollAccountRoleDefinition[] = [
  {
    key: 'salariesWagesExpense',
    label: 'Salaries and Wages Expense',
    description: 'Gross pay for the period.',
    category: GLAccountCategory.EXPENSE,
    core: true,
    isLiability: false,
    standardName: 'Salaries and Wages Expense',
    seedKey: 'salaries-wages-expense',
  },
  {
    key: 'employerSocialSecurityExpense',
    label: 'Employer Social Security Expense',
    description:
      "The employer's own social security contribution. Only needed when a payroll configuration has one.",
    category: GLAccountCategory.EXPENSE,
    core: false,
    isLiability: false,
    standardName: 'Employer Social Security Contribution Expense',
    seedKey: 'employer-social-security-expense',
  },
  {
    key: 'netPayPayable',
    label: 'Net Pay Payable',
    description: 'What is owed to employees after deductions.',
    category: GLAccountCategory.LIABILITY,
    core: true,
    isLiability: true,
    standardName: 'Net Pay Payable',
    seedKey: 'net-pay-payable',
  },
  {
    key: 'incomeTaxPayable',
    label: 'Income Tax Payable',
    description:
      'PAYE withheld, owed to the tax authority. Only needed when a payroll configuration withholds tax.',
    category: GLAccountCategory.LIABILITY,
    core: false,
    isLiability: true,
    standardName: 'Income Tax Payable',
    seedKey: 'income-tax-payable',
  },
  {
    key: 'socialSecurityPayable',
    label: 'Social Security Payable',
    description:
      'Employee and employer contributions owed to the fund. Only needed when a payroll configuration has them.',
    category: GLAccountCategory.LIABILITY,
    core: false,
    isLiability: true,
    standardName: 'Social Security Payable',
    seedKey: 'social-security-payable',
  },
  {
    key: 'statutoryPensionPayable',
    label: 'Statutory Pension Payable',
    description:
      'Private pension withheld, owed to the trustee. Only needed if you run one.',
    category: GLAccountCategory.LIABILITY,
    core: false,
    isLiability: true,
    standardName: 'Statutory Pension Payable',
    seedKey: 'statutory-pension-payable',
  },
  {
    key: 'otherDeductionsPayable',
    label: 'Other Deductions Payable',
    description:
      'Other amounts withheld from pay. Only needed when a run has any.',
    category: GLAccountCategory.LIABILITY,
    core: false,
    isLiability: true,
    standardName: 'Other Deductions Payable',
    seedKey: 'other-deductions-payable',
  },
];

export const PAYROLL_ROLE_KEYS = PAYROLL_ACCOUNT_ROLES.map((role) => role.key);

export function payrollRole(
  key: string,
): PayrollAccountRoleDefinition | undefined {
  return PAYROLL_ACCOUNT_ROLES.find((role) => role.key === key);
}
