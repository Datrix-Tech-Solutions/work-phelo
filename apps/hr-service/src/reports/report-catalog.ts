import { PrismaService } from '../prisma/prisma.service';

/**
 * The report builder never touches the database with anything the user typed. A report only
 * names a dataset and fields from this catalog; the loaders below decide what is read, and the
 * engine (report-engine.ts) groups and totals the result in memory.
 */

/** What a field can be used for. `text` is a column only: it can't be grouped, filtered or summed. */
export type ReportFieldKind = 'category' | 'date' | 'number' | 'text';

export type ReportValue = string | number | boolean | Date | null;
export type ReportRow = Record<string, ReportValue>;

export interface ReportField {
  key: string;
  label: string;
  kind: ReportFieldKind;
  /** Permission rule (for example `payroll:VIEW`) the user needs on top of the reports page. */
  requires?: string;
}

export interface ReportPeriod {
  from?: Date;
  to?: Date;
}

export interface ReportDataset {
  key: string;
  label: string;
  description: string;
  /** Permission rule the user needs to see this dataset at all. */
  requires?: string;
  fields: ReportField[];
  /** The date field the report period applies to. Always one of `fields`. */
  dateField: string;
  load: (
    prisma: PrismaService,
    tenantId: string,
    period: ReportPeriod,
  ) => Promise<ReportRow[]>;
}

/** Most rows one report block reads. Past this the block says it was cut short. */
export const REPORT_ROW_CAP = 50_000;

const NOT_SET = 'Not set';
const UNASSIGNED = 'Unassigned';

const label = (value: string | null | undefined, fallback = NOT_SET) =>
  value && value.length > 0 ? value : fallback;

/** `FULL_TIME` -> `Full time`. */
export const humanizeEnum = (value: string | null | undefined) => {
  if (!value) return NOT_SET;
  const spaced = value.toLowerCase().replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const fullName = (e: { firstName: string; lastName: string }) =>
  `${e.firstName} ${e.lastName}`.trim();

const dateRange = (period: ReportPeriod) =>
  period.from || period.to
    ? {
        ...(period.from ? { gte: period.from } : {}),
        ...(period.to ? { lte: period.to } : {}),
      }
    : undefined;

const startOfMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const employeesDataset: ReportDataset = {
  key: 'employees',
  label: 'Employees',
  description:
    'Headcount and workforce make-up by department, branch, status and more.',
  dateField: 'hireDate',
  fields: [
    { key: 'name', label: 'Employee', kind: 'text' },
    { key: 'employeeNumber', label: 'Employee number', kind: 'text' },
    { key: 'jobTitle', label: 'Job title', kind: 'category' },
    { key: 'department', label: 'Department', kind: 'category' },
    { key: 'branch', label: 'Branch', kind: 'category' },
    { key: 'gender', label: 'Gender', kind: 'category' },
    { key: 'employmentType', label: 'Employment type', kind: 'category' },
    { key: 'employmentStatus', label: 'Employment status', kind: 'category' },
    { key: 'maritalStatus', label: 'Marital status', kind: 'category' },
    { key: 'hireDate', label: 'Hire date', kind: 'date' },
    {
      key: 'basicSalary',
      label: 'Basic salary',
      kind: 'number',
      requires: 'payroll:VIEW',
    },
  ],
  async load(prisma, tenantId, period) {
    const hireDate = dateRange(period);
    const employees = await prisma.employee.findMany({
      where: { tenantId, ...(hireDate ? { hireDate } : {}) },
      take: REPORT_ROW_CAP,
      select: {
        firstName: true,
        lastName: true,
        employeeNumber: true,
        jobTitle: true,
        gender: true,
        employmentType: true,
        employmentStatus: true,
        maritalStatus: true,
        hireDate: true,
        basicSalary: true,
        department: { select: { name: true } },
        branch: { select: { name: true } },
      },
    });

    return employees.map((e) => ({
      name: fullName(e),
      employeeNumber: e.employeeNumber,
      jobTitle: label(e.jobTitle),
      department: label(e.department?.name, UNASSIGNED),
      branch: label(e.branch?.name, UNASSIGNED),
      gender: humanizeEnum(e.gender),
      employmentType: humanizeEnum(e.employmentType),
      employmentStatus: humanizeEnum(e.employmentStatus),
      maritalStatus: humanizeEnum(e.maritalStatus),
      hireDate: e.hireDate,
      basicSalary: Number(e.basicSalary),
    }));
  },
};

const leaveDataset: ReportDataset = {
  key: 'leave',
  label: 'Leave',
  description: 'Leave requests and days taken by type, department and status.',
  dateField: 'startDate',
  fields: [
    { key: 'employee', label: 'Employee', kind: 'text' },
    { key: 'department', label: 'Department', kind: 'category' },
    { key: 'leaveType', label: 'Leave type', kind: 'category' },
    { key: 'status', label: 'Status', kind: 'category' },
    { key: 'startDate', label: 'Start date', kind: 'date' },
    { key: 'endDate', label: 'End date', kind: 'date' },
    { key: 'requestedOn', label: 'Requested on', kind: 'date' },
    { key: 'totalDays', label: 'Days', kind: 'number' },
  ],
  async load(prisma, tenantId, period) {
    const startDate = dateRange(period);
    const requests = await prisma.leaveRequest.findMany({
      where: { tenantId, ...(startDate ? { startDate } : {}) },
      take: REPORT_ROW_CAP,
      select: {
        startDate: true,
        endDate: true,
        createdAt: true,
        totalDays: true,
        status: true,
        leaveType: { select: { name: true } },
        employee: {
          select: {
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    return requests.map((r) => ({
      employee: fullName(r.employee),
      department: label(r.employee.department?.name, UNASSIGNED),
      leaveType: r.leaveType.name,
      status: humanizeEnum(r.status),
      startDate: r.startDate,
      endDate: r.endDate,
      requestedOn: r.createdAt,
      totalDays: r.totalDays,
    }));
  },
};

const attendanceDataset: ReportDataset = {
  key: 'attendance',
  label: 'Attendance',
  description:
    'Clock-ins, hours worked and lateness by employee, department and work mode.',
  dateField: 'date',
  fields: [
    { key: 'employee', label: 'Employee', kind: 'text' },
    { key: 'department', label: 'Department', kind: 'category' },
    { key: 'workMode', label: 'Work mode', kind: 'category' },
    { key: 'punctuality', label: 'Punctuality', kind: 'category' },
    { key: 'date', label: 'Date', kind: 'date' },
    { key: 'hoursWorked', label: 'Hours worked', kind: 'number' },
  ],
  async load(prisma, tenantId, period) {
    const date = dateRange(period);
    const records = await prisma.clockRecord.findMany({
      where: { tenantId, ...(date ? { date } : {}) },
      take: REPORT_ROW_CAP,
      select: {
        date: true,
        hoursWorked: true,
        isLate: true,
        workMode: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    return records.map((r) => ({
      employee: fullName(r.employee),
      department: label(r.employee.department?.name, UNASSIGNED),
      workMode: humanizeEnum(r.workMode),
      punctuality: r.isLate ? 'Late' : 'On time',
      date: r.date,
      // An open clock record has no hours yet; leaving it null keeps it out of sums and averages.
      hoursWorked: r.hoursWorked === null ? null : Number(r.hoursWorked),
    }));
  },
};

const payrollDataset: ReportDataset = {
  key: 'payroll',
  label: 'Payroll',
  description: 'Payslip figures by department, month and run status.',
  requires: 'payroll:VIEW',
  dateField: 'payPeriod',
  fields: [
    { key: 'employee', label: 'Employee', kind: 'text' },
    { key: 'department', label: 'Department', kind: 'category' },
    { key: 'runStatus', label: 'Run status', kind: 'category' },
    { key: 'payPeriod', label: 'Pay period', kind: 'date' },
    { key: 'basicSalary', label: 'Basic salary', kind: 'number' },
    { key: 'totalAllowances', label: 'Allowances', kind: 'number' },
    { key: 'grossSalary', label: 'Gross pay', kind: 'number' },
    { key: 'incomeTax', label: 'Income tax', kind: 'number' },
    { key: 'totalDeductions', label: 'Total deductions', kind: 'number' },
    { key: 'netSalary', label: 'Net pay', kind: 'number' },
  ],
  async load(prisma, tenantId, period) {
    // A run's month and year are stored as two integers, so the period is applied after the
    // read. Runs are few (one per month per payslip type), so this stays small.
    const runs = await prisma.payrollRun.findMany({
      where: { tenantId },
      select: { id: true, month: true, year: true, status: true },
    });
    const inPeriod = runs
      .map((run) => ({
        ...run,
        payPeriod: new Date(Date.UTC(run.year, run.month - 1, 1)),
      }))
      .filter(
        (run) =>
          (!period.from || run.payPeriod >= startOfMonth(period.from)) &&
          (!period.to || run.payPeriod <= period.to),
      );
    if (inPeriod.length === 0) return [];
    const runById = new Map(inPeriod.map((run) => [run.id, run]));

    const items = await prisma.payrollItem.findMany({
      where: { tenantId, payrollRunId: { in: [...runById.keys()] } },
      take: REPORT_ROW_CAP,
      select: {
        payrollRunId: true,
        basicSalary: true,
        totalAllowances: true,
        grossSalary: true,
        incomeTax: true,
        payeTax: true,
        totalDeductions: true,
        netSalary: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    return items.flatMap((item) => {
      const run = runById.get(item.payrollRunId);
      if (!run) return [];
      // Runs made before payroll configurations keep their tax in `payeTax`.
      const incomeTax = Number(item.incomeTax) || Number(item.payeTax);
      return [
        {
          employee: fullName(item.employee),
          department: label(item.employee.department?.name, UNASSIGNED),
          runStatus: humanizeEnum(run.status),
          payPeriod: run.payPeriod,
          basicSalary: Number(item.basicSalary),
          totalAllowances: Number(item.totalAllowances),
          grossSalary: Number(item.grossSalary),
          incomeTax,
          totalDeductions: Number(item.totalDeductions),
          netSalary: Number(item.netSalary),
        },
      ];
    });
  },
};

export const REPORT_DATASETS: readonly ReportDataset[] = [
  employeesDataset,
  leaveDataset,
  attendanceDataset,
  payrollDataset,
];

export const getReportDataset = (key: string) =>
  REPORT_DATASETS.find((dataset) => dataset.key === key);
