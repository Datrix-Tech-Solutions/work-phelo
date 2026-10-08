import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  PAYSLIP_TYPES,
  buildPayslipLines,
  calculatePayslip,
  checkConfiguration,
  roleTotals,
  sumRoleTotals,
  variableAmounts,
  versionInForce,
  loanRepayment,
  allowancesFor,
  type PayComponent,
  type PayslipTypeKey,
  type RoleTotals,
  type SavedConfiguration,
} from '@work-phelo/payroll-engine';
import { RequestUser } from '@work-phelo/types';
import {
  EmploymentStatus,
  PayrollCountry,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { PayrollService } from '../payroll/payroll.service';
import { defaultPayrollCurrency } from '../common/payroll-calculator.helper';
import type {
  ApprovePayrollMonthDto,
  RunConfiguredPayrollDto,
} from './dto/run-configured-payroll.dto';

const toPayslipType = (value: string | null): PayslipTypeKey | null =>
  value ? (value.toLowerCase() as PayslipTypeKey) : null;

const money = (n: number) => n.toFixed(2);

/** The last day of the month as YYYY-MM-DD, which decides which configuration version applies. */
export function monthEndIso(month: number, year: number): string {
  const last = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

const name = (e: { firstName: string; lastName: string }) =>
  `${e.firstName} ${e.lastName}`;
const list = (names: string[]) =>
  names.length > 6
    ? `${names.slice(0, 6).join(', ')} and ${names.length - 6} more`
    : names.join(', ');

@Injectable()
export class PayrollRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly payroll: PayrollService,
  ) {}

  /**
   * Runs payroll for one payslip type and month. Every person on payroll must be in a payroll
   * group; the ones paid this way are worked out with the version of their group's configuration
   * in force at the end of the month, saved with a line per component, and the run goes to
   * approval. A month can't be run twice for the same type, and not at all once the old
   * calculators have run it.
   */
  async run(
    tenantId: string,
    actor: RequestUser,
    dto: RunConfiguredPayrollDto,
  ) {
    const { month, year, payslipType } = dto;
    const type = PAYSLIP_TYPES[payslipType];

    const existing = await this.prisma.payrollRun.findMany({
      where: { tenantId, month, year },
      select: { id: true, status: true, payslipKey: true },
    });
    if (existing.some((r) => r.payslipKey === 'legacy')) {
      throw new ConflictException(
        'Payroll for this month was already run in the old system.',
      );
    }
    const sameType = existing.find((r) => r.payslipKey === payslipType);
    if (sameType && sameType.status !== 'DRAFT') {
      throw new ConflictException(
        `${type.label} payroll for this month has already been run. Return it to draft to run it again.`,
      );
    }

    const monthEnd = monthEndIso(month, year);
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const [employees, groups, configurationRows, tenantConfig] =
      await Promise.all([
        this.prisma.employee.findMany({
          where: {
            tenantId,
            employmentStatus: {
              in: [EmploymentStatus.ACTIVE, EmploymentStatus.PROBATION],
            },
          },
          include: {
            allowances: {
              where: {
                isRecurring: true,
                effectiveFrom: { lte: end },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
              },
            },
            deductions: { where: { startDate: { lte: end } } },
          },
        }),
        this.prisma.payrollGroup.findMany({ where: { tenantId } }),
        this.prisma.payrollConfiguration.findMany({
          where: { tenantId },
          include: { versions: true },
        }),
        this.prisma.tenantConfig.findUnique({
          where: { tenantId },
          select: { payrollCountry: true, payrollCurrency: true },
        }),
      ]);

    const onPayroll = await this.verifiedOnly(tenantId, employees);
    if (onPayroll.length === 0) {
      throw new BadRequestException('No payroll-eligible employees found');
    }

    const withoutGroup = onPayroll.filter((e) => !e.payrollGroupId);
    if (withoutGroup.length) {
      throw new BadRequestException(
        `${withoutGroup.length} ${withoutGroup.length === 1 ? 'employee has' : 'employees have'} no ` +
          `payroll group (${list(withoutGroup.map(name))}). Add them to a group on Payroll ` +
          'Groups before running payroll, so nobody is left out.',
      );
    }

    const configurations: SavedConfiguration[] = configurationRows.map(
      (row) => ({
        id: row.id,
        name: row.name,
        payslipType: toPayslipType(row.payslipType),
        versions: [...row.versions]
          .sort((a, b) => a.version - b.version)
          .map((v) => ({
            version: v.version,
            effectiveFrom: v.effectiveFrom.toISOString().slice(0, 10),
            note: v.note,
            savedAt: v.createdAt.toISOString(),
            components: v.components as unknown as PayComponent[],
          })),
      }),
    );

    // Everyone paid this way, with the configuration their group uses.
    const members = onPayroll.flatMap((employee) => {
      const group = groups.find((g) => g.id === employee.payrollGroupId);
      const configuration = configurations.find(
        (c) => c.id === group?.configurationId,
      );
      if (!group || !configuration || configuration.payslipType !== payslipType)
        return [];
      return [{ employee, group, configuration }];
    });
    if (members.length === 0) {
      throw new BadRequestException(
        `No one is paid ${type.label.toLowerCase()} through a payroll group.`,
      );
    }

    // Each configuration's version in force must be usable before anyone is calculated.
    const versions = new Map<string, ReturnType<typeof versionInForce>>();
    for (const { configuration } of members) {
      if (versions.has(configuration.id)) continue;
      const version = versionInForce(configuration, monthEnd);
      if (!version) {
        throw new BadRequestException(
          `${configuration.name} has no version in force for this month yet.`,
        );
      }
      const { errors } = checkConfiguration(version.components, payslipType);
      if (errors.length) {
        throw new BadRequestException(
          `${configuration.name}: ${errors.join(' ')}`,
        );
      }
      versions.set(configuration.id, version);
    }

    const commissionFigures = dto.commissionFigures ?? {};
    const runAmounts = dto.amounts ?? {};
    const basicSalaries = dto.basicSalaries ?? {};
    const shortfalls: string[] = [];

    const payslips = members.map(({ employee, group, configuration }) => {
      const version = versions.get(configuration.id)!;
      const components = version.components;
      const commissionFigure = type.inputs.includes('commission')
        ? Math.max(0, Number(commissionFigures[employee.id]) || 0)
        : 0;
      const basic = type.inputs.includes('basic')
        ? Math.max(
            0,
            Number(basicSalaries[employee.id] ?? employee.basicSalary) || 0,
          )
        : 0;

      const allowanceRecords = employee.allowances.map((a) => ({
        type: a.type,
        name: a.name ?? a.type,
        amount: Number(a.amount),
      }));
      const loanRecords = employee.deductions.map((d) => ({
        totalAmount: Number(d.totalAmount),
        monthlyRate: Number(d.monthlyRate),
        amountPaid: Number(d.amountPaid),
        startDate: d.startDate.toISOString(),
      }));

      const result = calculatePayslip(
        components,
        { basic, commission: commissionFigure },
        variableAmounts({
          components,
          allowances: allowanceRecords,
          loans: loanRecords,
          runAmounts: runAmounts[employee.id],
          monthEnd,
        }),
      );
      if (result.shortfall > 0) shortfalls.push(name(employee));

      const lines = buildPayslipLines(components, result);
      const totals = roleTotals(lines, result.gross);

      // The allowances this payslip actually paid, kept as a record of what was on the employee.
      const paidAllowances = employee.allowances.filter((a) =>
        components.some(
          (c) =>
            c.enabled &&
            c.params.source === 'allowance' &&
            allowancesFor(c, [
              { type: a.type, name: a.name ?? a.type, amount: 0 },
            ]).length > 0,
        ),
      );
      // One record per loan, so paying the run can bring each loan's balance down.
      const hasLoansComponent = components.some(
        (c) =>
          c.enabled && c.method === 'variable' && c.params.source === 'loans',
      );
      const loanLines = hasLoansComponent
        ? employee.deductions
            .map((d) => ({
              employeeDeductionId: d.id,
              name: d.name,
              amount: loanRepayment({
                totalAmount: Number(d.totalAmount),
                monthlyRate: Number(d.monthlyRate),
                amountPaid: Number(d.amountPaid),
                startDate: d.startDate.toISOString(),
              }),
            }))
            .filter((l) => l.amount > 0)
        : [];

      return {
        employee,
        group,
        configuration,
        version,
        basic,
        commissionFigure,
        result,
        lines,
        totals,
        paidAllowances,
        loanLines,
      };
    });

    // Deductions bigger than pay would leave the books out of balance, so nothing is saved.
    if (shortfalls.length) {
      throw new BadRequestException(
        `Deductions are more than pay for ${list(shortfalls)}. Reduce their loan repayments or ` +
          'other deductions, then run payroll again.',
      );
    }

    const runTotals: RoleTotals = sumRoleTotals(payslips.map((p) => p.totals));
    const sum = (pick: (p: (typeof payslips)[number]) => number) =>
      payslips.reduce((total, p) => total + pick(p), 0);
    const totalNet = sum((p) => p.result.net);
    const totalEmployerCost = sum((p) => p.result.employerCost);

    const country = tenantConfig?.payrollCountry ?? PayrollCountry.GH;
    const currency =
      tenantConfig?.payrollCurrency ?? defaultPayrollCurrency(country);

    const run = await this.prisma.$transaction(async (tx) => {
      // A run returned to draft is replaced by the new one.
      if (sameType) await tx.payrollRun.delete({ where: { id: sameType.id } });

      return tx.payrollRun.create({
        data: {
          tenantId,
          month,
          year,
          payslipKey: payslipType,
          status: 'DRAFT',
          runBy: actor.id,
          notes: dto.notes,
          payrollCountry: country,
          payrollCurrency: currency,
          totalGross: money(runTotals.grossPay),
          totalNet: money(totalNet),
          totalEmployerCost: money(totalEmployerCost),
          totalEmployeeSocialSecurity: money(runTotals.employeeSocialSecurity),
          totalPension: money(runTotals.pension),
          totalIncomeTax: money(runTotals.incomeTax),
          totalOtherDeductions: money(runTotals.otherDeductions),
          totalEmployerSocialSecurity: money(runTotals.employerSocialSecurity),
          // The old totals are filled from the same roles so screens that still read them show
          // sensible figures for these runs.
          totalSSNIT: money(runTotals.employeeSocialSecurity),
          totalPAYE: money(runTotals.incomeTax),
          items: {
            create: payslips.map((p) => ({
              tenantId,
              employeeId: p.employee.id,
              basicSalary: money(p.basic),
              commissionFigure: money(p.commissionFigure),
              totalAllowances: money(
                p.paidAllowances.reduce(
                  (total, a) => total + Number(a.amount),
                  0,
                ),
              ),
              otherDeductions: money(p.totals.otherDeductions),
              grossSalary: money(p.result.gross),
              totalDeductions: money(p.result.totalDeductions),
              netSalary: money(p.result.net),
              taxableIncome: money(p.result.taxable),
              employeeSocialSecurity: money(p.totals.employeeSocialSecurity),
              pension: money(p.totals.pension),
              incomeTax: money(p.totals.incomeTax),
              employerSocialSecurity: money(p.totals.employerSocialSecurity),
              employeeSSNIT: money(p.totals.employeeSocialSecurity),
              employerSSNIT: money(p.totals.employerSocialSecurity),
              payeTax: money(p.totals.incomeTax),
              compensationTypeSnapshot: p.employee.compensationType,
              payrollGroupId: p.group.id,
              configurationId: p.configuration.id,
              configurationVersion: p.version.version,
              allowanceItems: {
                create: p.paidAllowances.map((a) => ({
                  tenantId,
                  name: a.name ?? a.type,
                  type: a.type,
                  amount: money(Number(a.amount)),
                })),
              },
              deductionItems: {
                create: p.loanLines.map((l) => ({
                  tenantId,
                  employeeDeductionId: l.employeeDeductionId,
                  name: l.name,
                  amount: money(l.amount),
                })),
              },
              lines: {
                create: p.lines.map((line, index) => ({
                  tenantId,
                  sortOrder: index,
                  componentId: line.componentId,
                  code: line.code,
                  name: line.name,
                  kind: line.kind,
                  role: line.role,
                  amount: money(line.amount),
                  relief: money(line.relief),
                  takenFromPay: line.takenFromPay,
                })),
              },
            })),
          },
        },
      });
    });

    // Running sends the payroll straight to approval, with the usual notifications.
    return this.payroll.submitPayrollForApproval(tenantId, run.id, actor);
  }

  /**
   * Approves every run of the month that is waiting for approval, each as its own record. A run
   * that can't be approved (for example accounting can't be reached) is reported and the others
   * still go through.
   */
  async approveMonth(
    tenantId: string,
    actor: RequestUser,
    dto: ApprovePayrollMonthDto,
  ) {
    const pending = await this.prisma.payrollRun.findMany({
      where: {
        tenantId,
        month: dto.month,
        year: dto.year,
        status: 'PENDING_APPROVAL',
        payslipKey: { not: 'legacy' },
      },
      select: { id: true, payslipKey: true },
      orderBy: { createdAt: 'asc' },
    });
    if (pending.length === 0) {
      throw new BadRequestException(
        'Nothing is waiting for approval for that month.',
      );
    }

    const approved: { runId: string; payslipType: string }[] = [];
    const failed: { runId: string; payslipType: string; message: string }[] =
      [];
    for (const run of pending) {
      try {
        await this.payroll.approvePayroll(tenantId, run.id, actor, {
          note: dto.note?.trim() || 'Approved',
        });
        approved.push({ runId: run.id, payslipType: run.payslipKey });
      } catch (error) {
        failed.push({
          runId: run.id,
          payslipType: run.payslipKey,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return { approved, failed };
  }

  /** People whose account is still waiting to be verified aren't paid yet. */
  private async verifiedOnly<T extends { userId: string | null }>(
    tenantId: string,
    employees: T[],
  ): Promise<T[]> {
    const userIds = employees
      .map((e) => e.userId)
      .filter((id): id is string => !!id);
    if (userIds.length === 0) return employees;
    const statuses = await this.rabbitmq.authGetUserStatuses({
      tenantId,
      userIds,
    });
    const verified = new Set(
      statuses
        .filter((s) => s.status !== 'PENDING_VERIFICATION')
        .map((s) => s.userId),
    );
    return employees.filter((e) => !e.userId || verified.has(e.userId));
  }
}
