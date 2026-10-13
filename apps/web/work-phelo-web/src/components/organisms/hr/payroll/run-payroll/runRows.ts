import {
  PAYSLIP_TYPES,
  calculatePayslip,
  versionInForce,
  type ConfigurationVersion,
  type PayComponent,
  type PayslipResult,
  type SavedConfiguration,
  type VariableAmounts,
} from '@/lib/payroll-engine';
import type { PayrollGroup } from '@/lib/payroll-groups';
import type { Employee } from '@/types/hr';

/** One employee on the run: who they are, how they are paid and what the engine worked out. */
export interface Row {
  id: string;
  employee: Employee;
  group: PayrollGroup;
  configuration: SavedConfiguration;
  /** The version of the configuration in force for this run, if any has started. */
  version: ConfigurationVersion | null;
  components: PayComponent[];
  result: PayslipResult | null;
  /** Why no payslip could be worked out. */
  problem: string | null;
}

export interface RunFigures {
  /** Basic salary changed for this run only, by employee id. The employee record is untouched. */
  basic: Record<string, number>;
  /** The commission figure typed in for each employee this run. */
  commission: Record<string, number>;
  /** Amounts typed in for the "typed each run" components, by employee then component id. */
  amounts: Record<string, Record<string, number>>;
}

/** People on payroll: active or on probation, and with a verified account. */
export function isOnPayroll(employee: Employee): boolean {
  return (
    (employee.employmentStatus === 'ACTIVE' || employee.employmentStatus === 'PROBATION') &&
    employee.userStatus !== 'PENDING_VERIFICATION'
  );
}

const sum = (list: number[]) => list.reduce((total, n) => total + n, 0);

/** The basic salary for this run: what was typed in, otherwise the employee record's. */
export function basicFor(employee: Employee, figures: RunFigures): number {
  return figures.basic[employee.id] ?? (Number(employee.basicSalary) || 0);
}

/** What an employee has in allowances of the kind a component pays. */
export function allowancesFor(employee: Employee, component: PayComponent) {
  const type = component.params.allowanceType;
  return (employee.allowances ?? []).filter(
    (a) => a.type === type && (type !== 'OTHER' || a.name === component.name),
  );
}

/** What this month's loan repayments take: the monthly rate, or what is left if that is less. */
export function loanRepayments(employee: Employee, monthEnd: string): number {
  return sum(
    (employee.deductions ?? [])
      .filter((d) => d.startDate.slice(0, 10) <= monthEnd)
      .map((d) =>
        Math.min(Math.max(0, Number(d.totalAmount) - Number(d.amountPaid)), Number(d.monthlyRate)),
      ),
  );
}

/** The amounts for a configuration's variable components, taken from the employee's records. */
function variablesFor(
  employee: Employee,
  components: PayComponent[],
  figures: RunFigures,
  monthEnd: string,
): VariableAmounts {
  const amounts: VariableAmounts = {};
  components
    .filter((c) => c.enabled && c.method === 'variable')
    .forEach((c) => {
      if (c.params.source === 'allowance') {
        amounts[c.id] = sum(allowancesFor(employee, c).map((a) => Number(a.amount)));
      } else if (c.params.source === 'loans') {
        amounts[c.id] = loanRepayments(employee, monthEnd);
      } else {
        amounts[c.id] = figures.amounts[employee.id]?.[c.id] ?? 0;
      }
    });
  return amounts;
}

/**
 * Works out every employee who is in a payroll group, with the configuration their group uses (the
 * version in force on `monthEnd`). Employees on payroll with no group are returned apart, since
 * nothing says how to pay them.
 */
export function buildRows(input: {
  employees: Employee[];
  groups: PayrollGroup[];
  configurations: SavedConfiguration[];
  figures: RunFigures;
  monthEnd: string;
}): { rows: Row[]; unassigned: Employee[] } {
  const { employees, groups, configurations, figures, monthEnd } = input;
  const rows: Row[] = [];
  const unassigned: Employee[] = [];

  employees.filter(isOnPayroll).forEach((employee) => {
    const group = groups.find((g) => g.id === employee.payrollGroupId);
    if (!group) {
      unassigned.push(employee);
      return;
    }
    const configuration = configurations.find((c) => c.id === group.configurationId);
    if (!configuration?.payslipType) return;

    const version = versionInForce(configuration, monthEnd);
    const components = version?.components ?? [];
    const type = PAYSLIP_TYPES[configuration.payslipType];
    let result: PayslipResult | null = null;
    let problem: string | null = null;
    if (!version) {
      problem = `${configuration.name} has no version in force yet.`;
    } else {
      try {
        result = calculatePayslip(
          components,
          {
            basic: type.inputs.includes('basic') ? basicFor(employee, figures) : 0,
            commission: type.inputs.includes('commission')
              ? (figures.commission[employee.id] ?? 0)
              : 0,
          },
          variablesFor(employee, components, figures, monthEnd),
        );
      } catch (e) {
        problem = e instanceof Error ? e.message : 'This payslip could not be worked out.';
      }
    }
    rows.push({
      id: employee.id,
      employee,
      group,
      configuration,
      version,
      components,
      result,
      problem,
    });
  });

  return { rows, unassigned };
}
