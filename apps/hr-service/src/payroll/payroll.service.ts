import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';
import {
  calculateSSNIT,
  calculateMonthlyPAYE,
  calculateGrossSalary,
  calculateNetSalary,
} from '../common/ghana-payroll.helper';
import { RunPayrollDto } from './dto/run-payroll.dto';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

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

    if (employees.length === 0)
      throw new BadRequestException('No active employees found');

    let totalGross = new Decimal(0);
    let totalNet = new Decimal(0);
    let totalSSNIT = new Decimal(0);
    let totalPAYE = new Decimal(0);

    const payrollItems = employees.map((emp) => {
      const basicSalary = emp.basicSalary.toString();
      const totalAllowances = emp.allowances
        .reduce(
          (sum, a) => sum.plus(new Decimal(a.amount.toString())),
          new Decimal(0),
        )
        .toString();

      const { employeeSSNIT, employerSSNIT } = calculateSSNIT(basicSalary);
      const grossSalary = calculateGrossSalary(
        basicSalary,
        totalAllowances,
        '0',
        '0',
        '0',
      );
      const payeTax = calculateMonthlyPAYE(grossSalary);
      const netSalary = calculateNetSalary(grossSalary, employeeSSNIT, payeTax);
      const totalDeductions = new Decimal(employeeSSNIT)
        .plus(new Decimal(payeTax))
        .toString();

      totalGross = totalGross.plus(new Decimal(grossSalary));
      totalNet = totalNet.plus(new Decimal(netSalary));
      totalSSNIT = totalSSNIT.plus(new Decimal(employeeSSNIT));
      totalPAYE = totalPAYE.plus(new Decimal(payeTax));

      return {
        tenantId,
        employeeId: emp.id,
        basicSalary,
        totalAllowances,
        overtimePay: '0',
        bonus: '0',
        thirteenthMonth: '0',
        grossSalary,
        employeeSSNIT,
        employerSSNIT,
        payeTax,
        totalDeductions,
        netSalary,
      };
    });

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
              select: { firstName: true, lastName: true, employeeNumber: true },
            },
          },
        },
      },
    });

    return payrollRun;
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
    if (run.status !== 'APPROVED')
      throw new BadRequestException('Payroll must be approved first');
    return this.prisma.payrollRun.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }

  async getPayrollRuns(tenantId: string) {
    return this.prisma.payrollRun.findMany({
      where: { tenantId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async getPayrollRunById(tenantId: string, id: string) {
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
