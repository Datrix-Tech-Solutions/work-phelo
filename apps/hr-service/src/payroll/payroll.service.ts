import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';
import {
  calculateMonthlyPAYE,
  calculatePayrollGross,
  calculatePayrollNetIncome,
  calculateSSNIT,
  calculateTier1Employee,
  calculateTier2,
  calculateTaxableIncome,
  calculateTier3Contribution,
  calculateTotalPayrollDeductions,
} from '../common/ghana-payroll.helper';
import { RunPayrollDto } from './dto/run-payroll.dto';
import { UpdatePayrollItemDto } from './dto/update-payroll-item.dto';
import {
  assertHrAccess,
  hasPermissionRule,
  isCompanyAdminUser,
} from '../auth/access-scope';

type PayrollSettingsSnapshot = {
  tier3Enabled: boolean;
  tier3Rate: string | null;
  tier3SchemeName: string | null;
};

type EditablePayrollValues = {
  basicSalary: string;
  totalAllowances: string;
  transportAmount: string;
  otherDeductions: string;
};

type CalculatedPayrollValues = EditablePayrollValues & {
  overtimePay: string;
  bonus: string;
  thirteenthMonth: string;
  grossSalary: string;
  employeeSSNIT: string;
  employerSSNIT: string;
  tier1Contribution: string;
  tier2Contribution: string;
  tier3Employee: string;
  taxableIncome: string;
  payeTax: string;
  totalDeductions: string;
  netSalary: string;
};

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  private getMonthBounds(
    month: number,
    year: number,
  ): { start: Date; end: Date } {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  }

  private async getPayrollSettingsSnapshot(
    tenantId: string,
  ): Promise<PayrollSettingsSnapshot> {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: {
        payrollTier3Enabled: true,
        payrollTier3Rate: true,
        payrollTier3SchemeName: true,
      },
    });

    return {
      tier3Enabled: config?.payrollTier3Enabled ?? false,
      tier3Rate:
        config?.payrollTier3Rate != null
          ? config.payrollTier3Rate.toString()
          : null,
      tier3SchemeName: config?.payrollTier3SchemeName ?? null,
    };
  }

  private calculatePayrollItemValues(
    values: EditablePayrollValues,
    settings: PayrollSettingsSnapshot,
  ): CalculatedPayrollValues {
    const grossSalary = calculatePayrollGross(
      values.basicSalary,
      values.totalAllowances,
      values.transportAmount,
      values.otherDeductions,
    );
    const { employeeSSNIT, employerSSNIT } = calculateSSNIT(values.basicSalary);
    const tier1Contribution = calculateTier1Employee(values.basicSalary);
    const tier2Contribution = calculateTier2(values.basicSalary);
    const tier3Employee =
      settings.tier3Enabled && settings.tier3Rate
        ? calculateTier3Contribution(values.basicSalary, settings.tier3Rate)
        : '0';
    const taxableIncome = calculateTaxableIncome(
      grossSalary,
      employeeSSNIT,
      values.transportAmount,
      tier3Employee,
    );
    const payeTax = calculateMonthlyPAYE(taxableIncome);
    const totalDeductions = calculateTotalPayrollDeductions(
      values.otherDeductions,
      employeeSSNIT,
      payeTax,
      tier3Employee,
    );
    const netSalary = calculatePayrollNetIncome(taxableIncome, payeTax);

    return {
      ...values,
      overtimePay: '0',
      bonus: '0',
      thirteenthMonth: '0',
      grossSalary,
      employeeSSNIT,
      employerSSNIT,
      tier1Contribution,
      tier2Contribution,
      tier3Employee,
      taxableIncome,
      payeTax,
      totalDeductions,
      netSalary,
    };
  }

  private buildSeedValuesFromEmployee(employee: {
    basicSalary: { toString(): string };
    allowances: Array<{
      amount: { toString(): string };
      type: string;
    }>;
  }): EditablePayrollValues {
    const transportAmount = employee.allowances
      .filter((allowance) => allowance.type === 'TRANSPORT')
      .reduce(
        (sum, allowance) => sum.plus(allowance.amount.toString()),
        new Decimal(0),
      );

    const totalAllowances = employee.allowances
      .filter((allowance) => allowance.type !== 'TRANSPORT')
      .reduce(
        (sum, allowance) => sum.plus(allowance.amount.toString()),
        new Decimal(0),
      );

    return {
      basicSalary: employee.basicSalary.toString(),
      totalAllowances: totalAllowances.toString(),
      transportAmount: transportAmount.toString(),
      otherDeductions: '0',
    };
  }

  private calculateRunTotals(
    items: Array<{
      grossSalary: { toString(): string } | string | number;
      netSalary: { toString(): string } | string | number;
      employeeSSNIT: { toString(): string } | string | number;
      employerSSNIT: { toString(): string } | string | number;
      tier1Contribution: { toString(): string } | string | number;
      tier2Contribution: { toString(): string } | string | number;
      tier3Employee: { toString(): string } | string | number;
      payeTax: { toString(): string } | string | number;
    }>,
  ) {
    return items.reduce(
      (acc, item) => {
        acc.totalGross = acc.totalGross.plus(item.grossSalary.toString());
        acc.totalNet = acc.totalNet.plus(item.netSalary.toString());
        acc.totalSSNIT = acc.totalSSNIT
          .plus(item.employeeSSNIT.toString())
          .plus(item.employerSSNIT.toString());
        acc.totalTier1 = acc.totalTier1.plus(item.tier1Contribution.toString());
        acc.totalTier2 = acc.totalTier2.plus(item.tier2Contribution.toString());
        acc.totalTier3 = acc.totalTier3.plus(item.tier3Employee.toString());
        acc.totalPAYE = acc.totalPAYE.plus(item.payeTax.toString());
        acc.totalEmployerCost = acc.totalEmployerCost
          .plus(item.grossSalary.toString())
          .plus(item.employerSSNIT.toString());
        return acc;
      },
      {
        totalGross: new Decimal(0),
        totalNet: new Decimal(0),
        totalSSNIT: new Decimal(0),
        totalTier1: new Decimal(0),
        totalTier2: new Decimal(0),
        totalTier3: new Decimal(0),
        totalPAYE: new Decimal(0),
        totalEmployerCost: new Decimal(0),
      },
    );
  }

  private async getEditableRunOrThrow(tenantId: string, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId },
      include: { items: true },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    if (run.status !== 'DRAFT') {
      throw new BadRequestException('Only draft payroll runs can be edited.');
    }

    return run;
  }

  async runPayroll(tenantId: string, runBy: string, dto: RunPayrollDto) {
    const existing = await this.prisma.payrollRun.findUnique({
      where: {
        tenantId_month_year: { tenantId, month: dto.month, year: dto.year },
      },
    });

    if (existing && existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Payroll for this month has already been processed',
      );
    }

    const { start, end } = this.getMonthBounds(dto.month, dto.year);
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, employmentStatus: 'ACTIVE' },
      include: {
        allowances: {
          where: {
            isRecurring: true,
            effectiveFrom: { lte: end },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
          },
        },
      },
    });

    if (employees.length === 0) {
      throw new BadRequestException('No active employees found');
    }

    const settings = await this.getPayrollSettingsSnapshot(tenantId);
    const payrollItems = employees.map((employee) =>
      this.calculatePayrollItemValues(
        this.buildSeedValuesFromEmployee(employee),
        settings,
      ),
    );
    const totals = this.calculateRunTotals(payrollItems);

    return this.prisma.payrollRun.upsert({
      where: {
        tenantId_month_year: { tenantId, month: dto.month, year: dto.year },
      },
      update: {
        status: 'DRAFT',
        totalGross: totals.totalGross.toString(),
        totalNet: totals.totalNet.toString(),
        totalSSNIT: totals.totalSSNIT.toString(),
        totalTier1: totals.totalTier1.toString(),
        totalTier2: totals.totalTier2.toString(),
        totalTier3: totals.totalTier3.toString(),
        totalPAYE: totals.totalPAYE.toString(),
        totalEmployerCost: totals.totalEmployerCost.toString(),
        runBy,
        submittedBy: null,
        submittedAt: null,
        approvedBy: null,
        approvedAt: null,
        paidAt: null,
        notes: dto.notes,
        tier3Enabled: settings.tier3Enabled,
        tier3Rate: settings.tier3Rate,
        tier3SchemeName: settings.tier3SchemeName,
        items: {
          deleteMany: {},
          create: payrollItems.map((item, index) => ({
            tenantId,
            employeeId: employees[index].id,
            ...item,
          })),
        },
      },
      create: {
        tenantId,
        month: dto.month,
        year: dto.year,
        status: 'DRAFT',
        totalGross: totals.totalGross.toString(),
        totalNet: totals.totalNet.toString(),
        totalSSNIT: totals.totalSSNIT.toString(),
        totalTier1: totals.totalTier1.toString(),
        totalTier2: totals.totalTier2.toString(),
        totalTier3: totals.totalTier3.toString(),
        totalPAYE: totals.totalPAYE.toString(),
        totalEmployerCost: totals.totalEmployerCost.toString(),
        runBy,
        notes: dto.notes,
        tier3Enabled: settings.tier3Enabled,
        tier3Rate: settings.tier3Rate,
        tier3SchemeName: settings.tier3SchemeName,
        items: {
          create: payrollItems.map((item, index) => ({
            tenantId,
            employeeId: employees[index].id,
            ...item,
          })),
        },
      },
      include: {
        items: {
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                employeeNumber: true,
                jobTitle: true,
              },
            },
          },
        },
      },
    });
  }

  async updatePayrollItem(
    tenantId: string,
    runId: string,
    itemId: string,
    dto: UpdatePayrollItemDto,
  ) {
    const run = await this.getEditableRunOrThrow(tenantId, runId);
    const currentItem = run.items.find((item) => item.id === itemId);

    if (!currentItem) {
      throw new NotFoundException('Payroll item not found');
    }

    const settings: PayrollSettingsSnapshot = {
      tier3Enabled: run.tier3Enabled,
      tier3Rate: run.tier3Rate?.toString() ?? null,
      tier3SchemeName: run.tier3SchemeName,
    };

    const recalculatedItem = this.calculatePayrollItemValues(
      {
        basicSalary:
          dto.basicSalary != null
            ? new Decimal(dto.basicSalary).toFixed(2)
            : currentItem.basicSalary.toString(),
        totalAllowances:
          dto.totalAllowances != null
            ? new Decimal(dto.totalAllowances).toFixed(2)
            : currentItem.totalAllowances.toString(),
        transportAmount:
          dto.transportAmount != null
            ? new Decimal(dto.transportAmount).toFixed(2)
            : currentItem.transportAmount.toString(),
        otherDeductions:
          dto.otherDeductions != null
            ? new Decimal(dto.otherDeductions).toFixed(2)
            : currentItem.otherDeductions.toString(),
      },
      settings,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.payrollItem.update({
        where: { id: itemId },
        data: recalculatedItem,
      });

      const items = await tx.payrollItem.findMany({
        where: { payrollRunId: runId, tenantId },
      });
      const totals = this.calculateRunTotals(items);

      await tx.payrollRun.update({
        where: { id: runId },
        data: {
          totalGross: totals.totalGross.toString(),
          totalNet: totals.totalNet.toString(),
          totalSSNIT: totals.totalSSNIT.toString(),
          totalTier1: totals.totalTier1.toString(),
          totalTier2: totals.totalTier2.toString(),
          totalTier3: totals.totalTier3.toString(),
          totalPAYE: totals.totalPAYE.toString(),
        },
      });

      return tx.payrollRun.findFirst({
        where: { id: runId, tenantId },
        include: {
          items: {
            include: {
              employee: {
                select: {
                  firstName: true,
                  lastName: true,
                  employeeNumber: true,
                  jobTitle: true,
                },
              },
            },
          },
        },
      });
    });
  }

  async submitPayrollForApproval(
    tenantId: string,
    runId: string,
    submittedBy: string,
  ) {
    const run = await this.getEditableRunOrThrow(tenantId, runId);

    if (run.items.length === 0) {
      throw new BadRequestException(
        'Draft payroll run has no payroll items to submit.',
      );
    }

    return this.prisma.payrollRun.update({
      where: { id: runId },
      data: {
        status: 'PENDING_APPROVAL',
        submittedBy,
        submittedAt: new Date(),
      },
    });
  }

  async returnPayrollToDraft(tenantId: string, id: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, tenantId },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(
        'Only payroll runs pending approval can be returned to draft.',
      );
    }

    return this.prisma.payrollRun.update({
      where: { id },
      data: {
        status: 'DRAFT',
        approvedBy: null,
        approvedAt: null,
      },
    });
  }

  async approvePayroll(tenantId: string, id: string, approvedBy: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, tenantId },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Payroll is not pending approval');
    }
    return this.prisma.payrollRun.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy, approvedAt: new Date() },
    });
  }

  async markAsPaid(tenantId: string, id: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, tenantId },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'APPROVED') {
      throw new BadRequestException('Payroll must be approved first');
    }
    return this.prisma.payrollRun.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }

  async getPayrollRuns(tenantId: string, actor: RequestUser) {
    if (!isCompanyAdminUser(actor)) {
      assertHrAccess(hasPermissionRule(actor, 'payroll:VIEW'));
    }

    return this.prisma.payrollRun.findMany({
      where: { tenantId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async getPayrollRunById(tenantId: string, id: string, actor: RequestUser) {
    if (!isCompanyAdminUser(actor)) {
      assertHrAccess(hasPermissionRule(actor, 'payroll:VIEW'));
    }

    const run = await this.prisma.payrollRun.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                employeeNumber: true,
                jobTitle: true,
                bankName: true,
                bankAccountNumber: true,
              },
            },
          },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }

  async getMyPayslips(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');

    return this.prisma.payrollItem.findMany({
      where: { employeeId: employee.id, tenantId },
      include: {
        payrollRun: {
          select: {
            month: true,
            year: true,
            status: true,
            paidAt: true,
            tier3Enabled: true,
            tier3Rate: true,
            tier3SchemeName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
