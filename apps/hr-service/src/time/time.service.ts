import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';
import { ClockInDto } from './dto/clock-in.dto';
import { TimeCorrectionDto } from './dto/time-correction.dto';
import { ReviewCorrectionDto } from './dto/review-correction.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import {
  assertHrAccess,
  getActorEmployee,
  hasPermissionRule,
  isCompanyAdminUser,
  isEmployeeSelfServiceUser,
} from '../auth/access-scope';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';

@Injectable()
export class TimeService {
  private readonly logger = new Logger(TimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: RabbitMQPublisher,
  ) {}

  private transformRecord(record: {
    id: string;
    clockIn: Date;
    clockOut: Date | null;
    hoursWorked: any;
    isLate: boolean;
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
      isLate: record.isLate,
    };
  }

  private async resolveIsLate(
    tenantId: string,
    employeeId: string,
    clockInTime: Date,
  ): Promise<boolean> {
    const today = new Date(clockInTime);
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = clockInTime.getDay();

    const [schedule, config] = await Promise.all([
      this.prisma.shiftSchedule.findFirst({
        where: {
          tenantId,
          employeeId,
          dayOfWeek: { has: dayOfWeek },
          effectiveFrom: { lte: today },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
        },
      }),
      this.prisma.tenantConfig.findUnique({
        where: { tenantId },
        select: { lateArrivalThresholdMinutes: true },
      }),
    ]);

    if (!schedule) return false;

    const [h, m] = schedule.startTime.split(':').map(Number);
    const shiftStart = new Date(today);
    shiftStart.setHours(h, m, 0, 0);
    const threshold = config?.lateArrivalThresholdMinutes ?? 0;
    const allowedUntil = new Date(shiftStart.getTime() + threshold * 60_000);
    return clockInTime > allowedUntil;
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

    const clockInTime = new Date();
    const isLate = await this.resolveIsLate(tenantId, employee.id, clockInTime);

    const record = await this.prisma.clockRecord.create({
      data: {
        tenantId,
        employeeId: employee.id,
        clockIn: clockInTime,
        date: today,
        isLate,
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
    actor: RequestUser,
    filters: {
      employeeId?: string;
      from?: string;
      to?: string;
      departmentId?: string;
      status?: string;
      search?: string;
      page?: number;
      mine?: boolean;
    },
  ) {
    const where: any = { tenantId };

    if (filters.mine) {
      const actorEmployee = await getActorEmployee(
        this.prisma,
        tenantId,
        actor.id,
      );
      where.employeeId = actorEmployee.id;
    } else if (isCompanyAdminUser(actor)) {
      if (filters.employeeId) where.employeeId = filters.employeeId;
    } else if (isEmployeeSelfServiceUser(actor)) {
      const actorEmployee = await getActorEmployee(
        this.prisma,
        tenantId,
        actor.id,
      );
      where.employeeId = actorEmployee.id;
    } else {
      assertHrAccess(hasPermissionRule(actor, 'attendance:VIEW'));
      if (filters.employeeId) where.employeeId = filters.employeeId;
    }

    if (filters.from || filters.to) {
      where.date = {};
      if (filters.from) where.date.gte = new Date(filters.from);
      if (filters.to) where.date.lte = new Date(filters.to);
    }

    const employeeWhere: any = {};
    if (filters.departmentId) employeeWhere.departmentId = filters.departmentId;

    const trimmedSearch = filters.search?.trim();
    if (trimmedSearch) {
      employeeWhere.OR = [
        { firstName: { contains: trimmedSearch, mode: 'insensitive' } },
        { lastName: { contains: trimmedSearch, mode: 'insensitive' } },
        { employeeNumber: { contains: trimmedSearch, mode: 'insensitive' } },
      ];
    }

    if (Object.keys(employeeWhere).length > 0) {
      where.employee = { is: employeeWhere };
    }

    if (filters.status === 'CLOCKED_IN') {
      where.clockOut = null;
    } else if (filters.status === 'CLOCKED_OUT') {
      where.clockOut = { not: null };
    }

    const page = Math.max(filters.page ?? 1, 1);
    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.clockRecord.count({ where }),
      this.prisma.clockRecord.findMany({
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
        orderBy: [{ date: 'desc' }, { clockIn: 'desc' }],
        skip,
        take: pageSize,
      }),
    ]);

    return {
      data,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      total,
      page,
    };
  }

  async submitTimeCorrection(
    tenantId: string,
    userId: string,
    dto: TimeCorrectionDto,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (!employee)
      throw new NotFoundException(
        'Employee profile not found. Please contact your administrator.',
      );

    const correction = await this.prisma.timeCorrection.create({
      data: {
        tenantId,
        employeeId: employee.id,
        date: new Date(dto.date),
        requestedIn: dto.requestedIn ? new Date(dto.requestedIn) : undefined,
        requestedOut: dto.requestedOut ? new Date(dto.requestedOut) : undefined,
        reason: dto.reason,
      },
    });

    const [config, manager] = await Promise.all([
      this.prisma.tenantConfig.findUnique({
        where: { tenantId },
        select: { adminEmail: true, adminUserId: true },
      }),
      employee.managerId
        ? this.prisma.employee.findFirst({
            where: { id: employee.managerId, tenantId },
            select: { email: true, userId: true },
          })
        : null,
    ]);

    const adminEmail = config?.adminEmail || null;
    const adminUserId = config?.adminUserId || null;
    const managerEmail = manager?.email ?? null;
    const managerUserId = manager?.userId ?? null;

    const employeeFullName = `${employee.firstName} ${employee.lastName}`;
    const attendanceDate = correction.date.toISOString().split('T')[0];

    if (!adminEmail) {
      this.logger.warn(
        `[time-correction] No admin email configured for tenant ${tenantId} — skipping admin notification`,
      );
    }
    if (!managerEmail) {
      this.logger.warn(
        `[time-correction] Employee ${employee.id} has no manager or manager has no email — skipping manager notification`,
      );
    }

    if (adminEmail || managerEmail) {
      this.publisher
        .notificationTimeCorrectionSubmitted({
          tenantId,
          correctionId: correction.id,
          employeeId: employee.id,
          employeeFirstName: employee.firstName,
          employeeLastName: employee.lastName,
          attendanceDate,
          requestedIn: correction.requestedIn?.toISOString() ?? null,
          requestedOut: correction.requestedOut?.toISOString() ?? null,
          reason: correction.reason,
          adminEmail,
          managerEmail,
        })
        .catch((err) =>
          this.logger.error(
            `[time-correction] Failed to publish notification event for correction ${correction.id}`,
            err,
          ),
        );
    }

    const inAppMessage = `${employeeFullName} submitted a time correction request for ${attendanceDate}`;
    const inAppLink = `/hr/time/corrections/${correction.id}`;

    const inAppRecipients: string[] = [];
    if (adminUserId) inAppRecipients.push(adminUserId);
    if (managerUserId && managerUserId !== adminUserId)
      inAppRecipients.push(managerUserId);

    if (inAppRecipients.length > 0) {
      await this.prisma.notification.createMany({
        data: inAppRecipients.map((uid) => ({
          tenantId,
          userId: uid,
          type: 'TIME_CORRECTION_SUBMITTED',
          message: inAppMessage,
          link: inAppLink,
        })),
      });
    }

    return correction;
  }

  async getTimeCorrections(
    tenantId: string,
    actor: RequestUser,
    filters: {
      employeeId?: string;
      status?: string;
    },
  ) {
    const where: any = { tenantId };

    if (isCompanyAdminUser(actor)) {
      if (filters.employeeId) where.employeeId = filters.employeeId;
    } else if (isEmployeeSelfServiceUser(actor)) {
      const actorEmployee = await getActorEmployee(
        this.prisma,
        tenantId,
        actor.id,
      );
      where.employeeId = actorEmployee.id;
    } else {
      assertHrAccess(hasPermissionRule(actor, 'time-corrections:VIEW'));
      if (filters.employeeId) where.employeeId = filters.employeeId;
    }

    if (filters.status) where.status = filters.status;

    return this.prisma.timeCorrection.findMany({
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
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewTimeCorrection(
    tenantId: string,
    id: string,
    reviewer: RequestUser,
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

    assertHrAccess(
      isCompanyAdminUser(reviewer) ||
        hasPermissionRule(reviewer, 'time-corrections:APPROVE'),
    );

    return this.prisma.timeCorrection.update({
      where: { id },
      data: {
        status: dto.action,
        reviewedBy: reviewer.id,
        reviewedAt: new Date(),
        reviewNote: dto.note,
      },
    });
  }

  async createSchedule(
    tenantId: string,
    actor: RequestUser,
    dto: CreateScheduleDto,
  ) {
    const canManageSchedules =
      isCompanyAdminUser(actor) || hasPermissionRule(actor, 'schedules:CREATE');
    assertHrAccess(canManageSchedules);

    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.shiftSchedule.create({
      data: {
        tenantId,
        createdBy: actor.id,
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

  async getSchedules(
    tenantId: string,
    actor: RequestUser,
    employeeId?: string,
  ) {
    let where: any = { tenantId, ...(employeeId ? { employeeId } : {}) };

    if (isEmployeeSelfServiceUser(actor)) {
      const actorEmployee = await getActorEmployee(
        this.prisma,
        tenantId,
        actor.id,
      );
      where = { tenantId, employeeId: actorEmployee.id };
    } else if (!isCompanyAdminUser(actor)) {
      assertHrAccess(hasPermissionRule(actor, 'schedules:VIEW'));
    }

    return this.prisma.shiftSchedule.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async getLiveAttendance(tenantId: string, actor: RequestUser) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    if (!isCompanyAdminUser(actor)) {
      assertHrAccess(hasPermissionRule(actor, 'attendance:VIEW'));
    }

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
      isLate: r.isLate,
    }));
  }

  async getAttendanceStats(tenantId: string, actor: RequestUser) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    if (!isCompanyAdminUser(actor)) {
      assertHrAccess(hasPermissionRule(actor, 'attendance:VIEW'));
    }

    const [total, todayRecords] = await Promise.all([
      this.prisma.employee.count({
        where: {
          tenantId,
          employmentStatus: { in: ['ACTIVE', 'PROBATION', 'SUSPENDED'] },
        },
      }),
      this.prisma.clockRecord.findMany({
        where: {
          tenantId,
          date: { gte: todayStart, lte: todayEnd },
        },
      }),
    ]);
    const clockedIn = todayRecords.filter((r) => !r.clockOut).length;
    const absent = Math.max(0, total - todayRecords.length);
    const late = todayRecords.filter((r) => r.isLate).length;
    return { clockedIn, absent, late, onBreak: 0, total };
  }
}
