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
import { UpdateScheduleDto } from './dto/update-schedule.dto';
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
    isOutsideSchedule: boolean;
    workMode: 'ONSITE' | 'REMOTE' | 'HYBRID' | null;
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
      isOutsideSchedule: record.isOutsideSchedule,
      workMode: record.workMode,
    };
  }

  private getDayBounds(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  private async getActiveSchedule(
    tenantId: string,
    employeeId: string,
    date: Date,
  ) {
    const dayOfWeek = date.getDay();
    const { start } = this.getDayBounds(date);

    return this.prisma.shiftSchedule.findFirst({
      where: {
        tenantId,
        employeeId,
        dayOfWeek: { has: dayOfWeek },
        effectiveFrom: { lte: start },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
      },
    });
  }

  private async ensureNotOnApprovedLeave(
    tenantId: string,
    employeeId: string,
    date: Date,
  ) {
    const { start, end } = this.getDayBounds(date);

    const leave = await this.prisma.leaveRequest.findFirst({
      where: {
        tenantId,
        employeeId,
        status: 'APPROVED',
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: {
        leaveType: {
          select: { name: true },
        },
      },
    });

    if (leave) {
      throw new BadRequestException(
        `You are on approved ${leave.leaveType.name} today and cannot clock in`,
      );
    }
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
    const clockInTime = new Date();
    const { start: today } = this.getDayBounds(clockInTime);

    await this.ensureNotOnApprovedLeave(tenantId, employee.id, clockInTime);

    const existing = await this.prisma.clockRecord.findFirst({
      where: { tenantId, employeeId: employee.id, date: today, clockOut: null },
    });

    if (existing) throw new BadRequestException('Already clocked in for today');

    const activeSchedule = await this.getActiveSchedule(
      tenantId,
      employee.id,
      clockInTime,
    );
    const isLate = await this.resolveIsLate(tenantId, employee.id, clockInTime);

    const record = await this.prisma.clockRecord.create({
      data: {
        tenantId,
        employeeId: employee.id,
        clockIn: clockInTime,
        date: today,
        isLate,
        isOutsideSchedule: !activeSchedule,
        workMode: activeSchedule?.workMode ?? null,
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

  private buildScheduleLink(tenantSlug: string): string {
    const base = process.env.FRONTEND_BASE_URL as string;
    return `${base}/${tenantSlug}/hr/scheduling?tab=my-schedule`;
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
      select: {
        id: true,
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const schedule = await this.prisma.shiftSchedule.create({
      data: {
        tenantId,
        createdBy: actor.id,
        employeeId: dto.employeeId,
        shiftType: dto.shiftType,
        workMode: dto.workMode ?? 'ONSITE',
        startTime: dto.startTime,
        endTime: dto.endTime,
        dayOfWeek: dto.dayOfWeek,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
      },
    });

    const scheduleLink = this.buildScheduleLink(actor.tenantSlug);
    const formattedDate = new Date(
      dto.effectiveFrom + 'T00:00:00',
    ).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // In-app notification to the employee
    if (employee.userId) {
      await this.prisma.notification.create({
        data: {
          tenantId,
          userId: employee.userId,
          type: 'SCHEDULE_PUBLISHED',
          message: `A new shift schedule has been published for you, effective ${formattedDate}. Check your schedule.`,
          link: scheduleLink,
        },
      });
    }

    // Email notification via RabbitMQ (fire-and-forget)
    void this.publisher
      .notificationSchedulePublished({
        tenantId,
        employeeId: employee.id,
        employeeEmail: employee.email,
        employeeFirstName: employee.firstName,
        employeeLastName: employee.lastName,
        effectiveFrom: dto.effectiveFrom,
        shiftType: dto.shiftType,
        startTime: dto.startTime,
        endTime: dto.endTime,
        scheduleLink,
      })
      .catch((err) =>
        this.logger.error(
          `Failed to emit schedule_published notification for employee ${employee.id}`,
          err,
        ),
      );

    return schedule;
  }

  async updateSchedule(
    tenantId: string,
    scheduleId: string,
    actor: RequestUser,
    dto: UpdateScheduleDto,
  ) {
    const canManageSchedules =
      isCompanyAdminUser(actor) || hasPermissionRule(actor, 'schedules:CREATE');
    assertHrAccess(canManageSchedules);

    const schedule = await this.prisma.shiftSchedule.findFirst({
      where: { id: scheduleId, tenantId },
      include: {
        employee: {
          select: { id: true, userId: true, firstName: true, lastName: true },
        },
      },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');

    const updated = await this.prisma.shiftSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(dto.shiftType && { shiftType: dto.shiftType }),
        ...(dto.workMode && { workMode: dto.workMode }),
        ...(dto.startTime && { startTime: dto.startTime }),
        ...(dto.endTime && { endTime: dto.endTime }),
        ...(dto.effectiveTo !== undefined && {
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        }),
      },
    });

    const formattedDate = schedule.effectiveFrom.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    if (schedule.employee.userId) {
      await this.prisma.notification.create({
        data: {
          tenantId,
          userId: schedule.employee.userId,
          type: 'SCHEDULE_UPDATED',
          message: `Your shift on ${formattedDate} has been updated. Please check your schedule.`,
          link: this.buildScheduleLink(actor.tenantSlug),
        },
      });
    }

    return updated;
  }

  async deleteSchedule(
    tenantId: string,
    scheduleId: string,
    actor: RequestUser,
  ) {
    const canManageSchedules =
      isCompanyAdminUser(actor) || hasPermissionRule(actor, 'schedules:CREATE');
    assertHrAccess(canManageSchedules);

    const schedule = await this.prisma.shiftSchedule.findFirst({
      where: { id: scheduleId, tenantId },
      include: {
        employee: {
          select: { id: true, userId: true, firstName: true, lastName: true },
        },
      },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');

    await this.prisma.shiftSchedule.delete({ where: { id: scheduleId } });

    const formattedDate = schedule.effectiveFrom.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    if (schedule.employee.userId) {
      await this.prisma.notification.create({
        data: {
          tenantId,
          userId: schedule.employee.userId,
          type: 'SCHEDULE_REMOVED',
          message: `Your shift on ${formattedDate} has been removed from the schedule.`,
          link: this.buildScheduleLink(actor.tenantSlug),
        },
      });
    }

    return { message: 'Schedule deleted successfully' };
  }

  async getMySchedule(
    tenantId: string,
    actor: RequestUser,
    filters: { from?: string; to?: string },
  ) {
    const actorEmployee = await getActorEmployee(
      this.prisma,
      tenantId,
      actor.id,
    );

    const fromDate = filters.from
      ? new Date(filters.from + 'T00:00:00')
      : undefined;
    const toDate = filters.to ? new Date(filters.to + 'T23:59:59') : undefined;

    const [schedules, leaveRequests, publicHolidays] = await Promise.all([
      this.prisma.shiftSchedule.findMany({
        where: {
          tenantId,
          employeeId: actorEmployee.id,
          ...(fromDate && {
            effectiveFrom: { lte: toDate ?? new Date('2099-12-31') },
          }),
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: fromDate ?? new Date('2000-01-01') } },
          ],
        },
        orderBy: { effectiveFrom: 'asc' },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          tenantId,
          employeeId: actorEmployee.id,
          status: 'APPROVED',
          ...(fromDate && { endDate: { gte: fromDate } }),
          ...(toDate && { startDate: { lte: toDate } }),
        },
        include: { leaveType: { select: { name: true } } },
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.publicHoliday.findMany({
        where: {
          tenantId,
          ...(fromDate && { date: { gte: fromDate } }),
          ...(toDate && { date: { lte: toDate } }),
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    return {
      schedules,
      leaveBlocks: leaveRequests.map((r) => ({
        id: r.id,
        startDate: r.startDate.toISOString().slice(0, 10),
        endDate: r.endDate.toISOString().slice(0, 10),
        totalDays: r.totalDays,
        leaveType: r.leaveType.name,
      })),
      publicHolidays: publicHolidays.map((h) => ({
        id: h.id,
        name: h.name,
        date: h.date.toISOString().slice(0, 10),
      })),
    };
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
      isOutsideSchedule: r.isOutsideSchedule,
      workMode: r.workMode,
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
    const flagged = todayRecords.filter((r) => r.isOutsideSchedule).length;
    return { clockedIn, absent, late, flagged, onBreak: 0, total };
  }
}
