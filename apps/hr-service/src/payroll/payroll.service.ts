import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';
import {
  calculateSSNIT,
  calculateMonthlyPAYE,
  calculateNetSalary,
} from '../common/ghana-payroll.helper';
import { RunPayrollDto } from './dto/run-payroll.dto';
import {
  assertHrAccess,
  hasPermissionRule,
  isCompanyAdminUser,
} from '../auth/access-scope';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private getMonthBounds(
    month: number,
    year: number,
  ): { start: Date; end: Date } {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  }

  private countWorkingDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  // ── Pull overtime from clock records ─────────────────────────────────────

  private async getOvertimePay(
    employeeId: string,
    tenantId: string,
    start: Date,
    end: Date,
    basicSalary: string,
    workingDays: number,
  ): Promise<{ overtimeHours: string; overtimePay: string }> {
    const clockRecords = await this.prisma.clockRecord.findMany({
      where: {
        tenantId,
        employeeId,
        date: { gte: start, lte: end },
        clockOut: { not: null },
      },
    });

    const totalHours = clockRecords.reduce((sum, r) => {
      return sum.plus(new Decimal(r.hoursWorked?.toString() || '0'));
    }, new Decimal(0));

    const basicDec = new Decimal(basicSalary);
    const standardHours = new Decimal(workingDays * 8);
    const overtimeHours = Decimal.max(
      new Decimal(0),
      totalHours.minus(standardHours),
    );

    const hourlyRate = basicDec.div(standardHours);
    const overtimePay = overtimeHours
      .times(hourlyRate)
      .times('1.5')
      .toDecimalPlaces(2);

    return {
      overtimeHours: overtimeHours.toString(),
      overtimePay: overtimePay.toString(),
    };
  }

  // ── Pull unpaid leave deductions ──────────────────────────────────────────

  private async getLeaveDeduction(
    employeeId: string,
    tenantId: string,
    start: Date,
    end: Date,
    basicSalary: string,
    workingDays: number,
  ): Promise<{ unpaidDays: number; leaveDeduction: string }> {
    // Get approved leave requests that overlap this payroll period
    const leaveRequests = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        employeeId,
        status: 'APPROVED',
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: { leaveType: { select: { isPaid: true } } },
    });

    // Count only UNPAID leave days that fall within the payroll month
    let unpaidDays = 0;
    for (const req of leaveRequests) {
      if (req.leaveType.isPaid) continue;

      // Clamp leave period to payroll month
      const leaveStart = req.startDate < start ? start : req.startDate;
      const leaveEnd = req.endDate > end ? end : req.endDate;
      const days = this.countWorkingDays(leaveStart, leaveEnd);
      unpaidDays += days;
    }

    const basicDec = new Decimal(basicSalary);
    const dailyRate = basicDec.div(workingDays).toDecimalPlaces(2);
    const leaveDeduction = new Decimal(unpaidDays)
      .times(dailyRate)
      .toDecimalPlaces(2);

    return { unpaidDays, leaveDeduction: leaveDeduction.toString() };
  }

  // ── Run Payroll ───────────────────────────────────────────────────────────

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

    const employees = await this.prisma.employee.findMany({
      where: { tenantId, employmentStatus: 'ACTIVE' },
      include: { allowances: { where: { isRecurring: true } } },
    });

    if (employees.length === 0) {
      throw new BadRequestException('No active employees found');
    }

    const { start, end } = this.getMonthBounds(dto.month, dto.year);
    const workingDays = this.countWorkingDays(start, end);

    let totalGross = new Decimal(0);
    let totalNet = new Decimal(0);
    let totalSSNIT = new Decimal(0);
    let totalPAYE = new Decimal(0);

    const payrollItems = await Promise.all(
      employees.map(async (emp) => {
        const basicSalary = new Decimal(emp.basicSalary.toString());
        const totalAllowances = emp.allowances.reduce(
          (sum, a) => sum.plus(new Decimal(a.amount.toString())),
          new Decimal(0),
        );

        // Pull overtime from clock records
        const { overtimePay } = await this.getOvertimePay(
          emp.id,
          tenantId,
          start,
          end,
          basicSalary.toString(),
          workingDays,
        );

        // Pull unpaid leave deductions
        const { leaveDeduction } = await this.getLeaveDeduction(
          emp.id,
          tenantId,
          start,
          end,
          basicSalary.toString(),
          workingDays,
        );

        // Gross = basic + allowances + overtime - unpaid leave deduction
        const grossSalary = basicSalary
          .plus(totalAllowances)
          .plus(new Decimal(overtimePay))
          .minus(new Decimal(leaveDeduction))
          .toDecimalPlaces(2);

        const { employeeSSNIT, employerSSNIT } = calculateSSNIT(
          basicSalary.toString(),
        );
        const payeTax = calculateMonthlyPAYE(grossSalary.toString());
        const netSalary = calculateNetSalary(
          grossSalary.toString(),
          employeeSSNIT,
          payeTax,
        );

        const totalDeductions = new Decimal(employeeSSNIT)
          .plus(new Decimal(payeTax))
          .plus(leaveDeduction)
          .toString();

        totalGross = totalGross.plus(grossSalary);
        totalNet = totalNet.plus(new Decimal(netSalary));
        totalSSNIT = totalSSNIT.plus(new Decimal(employeeSSNIT));
        totalPAYE = totalPAYE.plus(new Decimal(payeTax));

        return {
          tenantId,
          employeeId: emp.id,
          basicSalary: basicSalary.toString(),
          totalAllowances: totalAllowances.toString(),
          overtimePay: overtimePay.toString(),
          bonus: '0',
          thirteenthMonth: '0',
          grossSalary: grossSalary.toString(),
          employeeSSNIT,
          employerSSNIT,
          payeTax,
          totalDeductions,
          netSalary,
        };
      }),
    );

    const payrollRun = await this.prisma.payrollRun.upsert({
      where: {
        tenantId_month_year: { tenantId, month: dto.month, year: dto.year },
      },
      update: {
        status: 'PENDING_APPROVAL',
        totalGross: totalGross.toString(),
        totalNet: totalNet.toString(),
        totalSSNIT: totalSSNIT.toString(),
        totalPAYE: totalPAYE.toString(),
        runBy,
        notes: dto.notes,
        items: { deleteMany: {}, create: payrollItems },
      },
      create: {
        tenantId,
        month: dto.month,
        year: dto.year,
        status: 'PENDING_APPROVAL',
        totalGross: totalGross.toString(),
        totalNet: totalNet.toString(),
        totalSSNIT: totalSSNIT.toString(),
        totalPAYE: totalPAYE.toString(),
        runBy,
        notes: dto.notes,
        items: { create: payrollItems },
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

    return payrollRun;
  }

  // ── Approve / Paid / Get ──────────────────────────────────────────────────

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
          select: { month: true, year: true, status: true, paidAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
