import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';
import { ClockInDto } from './dto/clock-in.dto';
import { TimeCorrectionDto } from './dto/time-correction.dto';
import { ReviewCorrectionDto } from './dto/review-correction.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';

@Injectable()
export class TimeService {
  constructor(private readonly prisma: PrismaService) {}

  private transformRecord(record: {
    id: string;
    clockIn: Date;
    clockOut: Date | null;
    hoursWorked: any;
  }) {
    const status = record.clockOut ? 'CLOCKED_OUT' : 'CLOCKED_IN';
    const totalMinutes = record.clockOut
      ? Math.round(Number(record.hoursWorked) * 60)
      : 0;
    return {
      entryId: record.id,
      status,
      clockIn: record.clockIn.toISOString(),
      clockOut: record.clockOut?.toISOString() ?? null,
      breakStart: null,
      totalMinutes,
      breakMinutes: 0,
      isLate: false,
    };
  }

  private async getEmployeeByUserId(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (!employee)
      throw new NotFoundException(
        'Employee profile not found. Please contact your administrator.',
      );
    return employee;
  }

  async clockIn(
    tenantId: string,
    userId: string,
    dto: ClockInDto,
    ipAddress?: string,
  ) {
    const employee = await this.getEmployeeByUserId(tenantId, userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.clockRecord.findFirst({
      where: { tenantId, employeeId: employee.id, date: today, clockOut: null },
    });

    if (existing) throw new BadRequestException('Already clocked in for today');

    const record = await this.prisma.clockRecord.create({
      data: {
        tenantId,
        employeeId: employee.id,
        clockIn: new Date(),
        date: today,
        ipAddress,
        location: dto.location,
        note: dto.note,
      },
    });
    return this.transformRecord(record);
  }

  async clockOut(tenantId: string, userId: string) {
    const employee = await this.getEmployeeByUserId(tenantId, userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await this.prisma.clockRecord.findFirst({
      where: { tenantId, employeeId: employee.id, date: today, clockOut: null },
    });

    if (!record)
      throw new BadRequestException('No active clock-in found for today');

    const clockOut = new Date();
    const milliseconds = clockOut.getTime() - record.clockIn.getTime();
    const hoursWorked = new Decimal(milliseconds)
      .div(3600000)
      .toDecimalPlaces(2)
      .toString();

    const updated = await this.prisma.clockRecord.update({
      where: { id: record.id },
      data: { clockOut, hoursWorked },
    });
    return this.transformRecord(updated);
  }

  async getTodayStatus(tenantId: string, userId: string) {
    const employee = await this.getEmployeeByUserId(tenantId, userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const record = await this.prisma.clockRecord.findFirst({
      where: { tenantId, employeeId: employee.id, date: today },
    });
    if (!record) return null;
    return this.transformRecord(record);
  }

  async getMyAttendance(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (!employee) return [];
    return this.prisma.clockRecord.findMany({
      where: { tenantId, employeeId: employee.id },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            jobTitle: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async getAttendance(
    tenantId: string,
    filters: {
      employeeId?: string;
      from?: string;
      to?: string;
    },
  ) {
    const where: any = { tenantId };
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.from || filters.to) {
      where.date = {};
      if (filters.from) where.date.gte = new Date(filters.from);
      if (filters.to) where.date.lte = new Date(filters.to);
    }

    return this.prisma.clockRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            jobTitle: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async submitTimeCorrection(
    tenantId: string,
    userId: string,
    dto: TimeCorrectionDto,
  ) {
    const employee = await this.getEmployeeByUserId(tenantId, userId);
    return this.prisma.timeCorrection.create({
      data: {
        tenantId,
        employeeId: employee.id,
        date: new Date(dto.date),
        requestedIn: dto.requestedIn ? new Date(dto.requestedIn) : undefined,
        requestedOut: dto.requestedOut ? new Date(dto.requestedOut) : undefined,
        reason: dto.reason,
      },
    });
  }

  async getTimeCorrections(
    tenantId: string,
    filters: {
      employeeId?: string;
      status?: string;
    },
  ) {
    const where: any = { tenantId };
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status) where.status = filters.status;

    return this.prisma.timeCorrection.findMany({
      where,
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeNumber: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewTimeCorrection(
    tenantId: string,
    id: string,
    reviewerId: string,
    dto: ReviewCorrectionDto,
  ) {
    const correction = await this.prisma.timeCorrection.findFirst({
      where: { id, tenantId },
    });
    if (!correction) throw new NotFoundException('Time correction not found');
    if (correction.status !== 'PENDING') {
      throw new BadRequestException(
        'This correction has already been reviewed',
      );
    }

    return this.prisma.timeCorrection.update({
      where: { id },
      data: {
        status: dto.action,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: dto.note,
      },
    });
  }

  async createSchedule(
    tenantId: string,
    createdBy: string,
    dto: CreateScheduleDto,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.shiftSchedule.create({
      data: {
        tenantId,
        createdBy,
        employeeId: dto.employeeId,
        shiftType: dto.shiftType,
        startTime: dto.startTime,
        endTime: dto.endTime,
        dayOfWeek: dto.dayOfWeek,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
      },
    });
  }

  async getSchedules(tenantId: string, employeeId?: string) {
    return this.prisma.shiftSchedule.findMany({
      where: { tenantId, ...(employeeId ? { employeeId } : {}) },
      include: {
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async getLiveAttendance(tenantId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const records = await this.prisma.clockRecord.findMany({
      where: {
        tenantId,
        date: { gte: todayStart, lte: todayEnd },
        clockOut: null,
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
            jobTitle: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { clockIn: 'asc' },
    });
    return records.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      avatarUrl: r.employee.avatarUrl ?? undefined,
      department: r.employee.department?.name ?? undefined,
      jobTitle: r.employee.jobTitle ?? undefined,
      clockIn: r.clockIn.toISOString(),
      breakStart: undefined,
      status: 'CLOCKED_IN',
      isLate: false,
    }));
  }

  async getAttendanceStats(tenantId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const [total, todayRecords] = await Promise.all([
      this.prisma.employee.count({
        where: {
          tenantId,
          employmentStatus: { in: ['ACTIVE', 'PROBATION', 'SUSPENDED'] },
        },
      }),
      this.prisma.clockRecord.findMany({
        where: { tenantId, date: { gte: todayStart, lte: todayEnd } },
      }),
    ]);
    const clockedIn = todayRecords.filter((r) => !r.clockOut).length;
    const absent = Math.max(0, total - todayRecords.length);
    return { clockedIn, absent, late: 0, onBreak: 0, total };
  }
}
