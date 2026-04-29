import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';
import { ClockInDto } from './dto/clock-in.dto';
import { TimeCorrectionDto } from './dto/time-correction.dto';
import { ReviewCorrectionDto } from './dto/review-correction.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CreateShiftSwapDto } from './dto/create-shift-swap.dto';
import { RespondShiftSwapDto } from './dto/respond-shift-swap.dto';
import { ReviewShiftSwapDto } from './dto/review-shift-swap.dto';
import {
  assertHrAccess,
  getActorEmployee,
  hasPermissionRule,
  isCompanyAdminUser,
  isEmployeeSelfServiceUser,
} from '../auth/access-scope';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { NotificationsService } from '../notifications/notifications.service';
import {
  EmploymentStatus,
  Prisma,
  ShiftSchedule,
  ShiftSwapRequest,
  ShiftSwapStatus,
} from '../../prisma/generated/client';

@Injectable()
export class TimeService {
  private readonly logger = new Logger(TimeService.name);
  private readonly swapSearchWindowDays = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: RabbitMQPublisher,
    private readonly notificationsService: NotificationsService,
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

  private parseDateOnly(value: string): Date {
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid shift date');
    }
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  private formatDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private isFutureShiftDate(date: Date): boolean {
    const { start: today } = this.getDayBounds(new Date());
    return date.getTime() > today.getTime();
  }

  private formatShiftForMessage(
    date: Date,
    startTime: string,
    endTime: string,
  ) {
    return `${date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })} ${startTime}-${endTime}`;
  }

  private scheduleAppliesOnDate(schedule: ShiftSchedule, date: Date): boolean {
    const { start } = this.getDayBounds(date);
    const effectiveFrom = new Date(schedule.effectiveFrom);
    effectiveFrom.setHours(0, 0, 0, 0);
    const effectiveTo = schedule.effectiveTo
      ? new Date(schedule.effectiveTo)
      : null;
    effectiveTo?.setHours(0, 0, 0, 0);

    return (
      schedule.dayOfWeek.includes(start.getDay()) &&
      effectiveFrom.getTime() <= start.getTime() &&
      (!effectiveTo || effectiveTo.getTime() >= start.getTime())
    );
  }

  private listScheduleOccurrences(
    schedule: ShiftSchedule,
    from: Date,
    to: Date,
  ): Date[] {
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(0, 0, 0, 0);

    const dates: Date[] = [];
    while (cursor.getTime() <= end.getTime()) {
      if (this.scheduleAppliesOnDate(schedule, cursor)) {
        dates.push(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }

  private async hasApprovedLeaveOnDate(
    tenantId: string,
    employeeId: string,
    date: Date,
  ): Promise<boolean> {
    const { start, end } = this.getDayBounds(date);
    const leave = await this.prisma.leaveRequest.findFirst({
      where: {
        tenantId,
        employeeId,
        status: 'APPROVED',
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { id: true },
    });

    return Boolean(leave);
  }

  private async assertNoApprovedLeaveOnDate(
    tenantId: string,
    employeeId: string,
    date: Date,
    message: string,
  ) {
    const hasLeave = await this.hasApprovedLeaveOnDate(
      tenantId,
      employeeId,
      date,
    );
    if (hasLeave) {
      throw new BadRequestException(message);
    }
  }

  private async getScheduleForSwap(
    tenantId: string,
    scheduleId: string,
  ): Promise<
    ShiftSchedule & {
      employee: {
        id: string;
        userId: string | null;
        firstName: string;
        lastName: string;
        managerId: string | null;
        departmentId: string | null;
      };
    }
  > {
    const schedule = await this.prisma.shiftSchedule.findFirst({
      where: { id: scheduleId, tenantId },
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            managerId: true,
            departmentId: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Shift schedule not found');
    }

    return schedule;
  }

  private async resolveSwapManagerEmployeeId(
    tenantId: string,
    requester: {
      managerId: string | null;
      departmentId: string | null;
    },
    target: {
      managerId: string | null;
      departmentId: string | null;
    },
  ): Promise<string | null> {
    if (requester.managerId && requester.managerId === target.managerId) {
      return requester.managerId;
    }

    if (
      requester.departmentId &&
      requester.departmentId === target.departmentId
    ) {
      const department = await this.prisma.department.findFirst({
        where: { tenantId, id: requester.departmentId, isActive: true },
        select: { managerId: true },
      });
      return department?.managerId ?? null;
    }

    return null;
  }

  private areSameTeam(
    requester: { managerId: string | null; departmentId: string | null },
    colleague: { managerId: string | null; departmentId: string | null },
  ): boolean {
    if (requester.managerId && requester.managerId === colleague.managerId) {
      return true;
    }

    return Boolean(
      requester.departmentId &&
      colleague.departmentId &&
      requester.departmentId === colleague.departmentId,
    );
  }

  private async ensureNoActiveSwapConflict(
    tenantId: string,
    scheduleId: string,
    shiftDate: Date,
  ) {
    const existing = await this.prisma.shiftSwapRequest.findFirst({
      where: {
        tenantId,
        status: { in: ['PENDING_COLLEAGUE', 'PENDING_MANAGER'] },
        OR: [
          { requesterScheduleId: scheduleId, requesterShiftDate: shiftDate },
          { targetScheduleId: scheduleId, targetShiftDate: shiftDate },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        'There is already an active swap request for one of these shifts',
      );
    }
  }

  private async notifyShiftSwapUsers(
    notifications: {
      tenantId: string;
      userId: string | null | undefined;
      type: string;
      message: string;
      link?: string;
    }[],
  ) {
    const filtered = notifications.filter(
      (
        notification,
      ): notification is {
        tenantId: string;
        userId: string;
        type: string;
        message: string;
        link?: string;
      } => Boolean(notification.userId),
    );

    if (filtered.length) {
      await this.notificationsService.createMany(filtered);
    }
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

  async getEligibleShiftSwapColleagues(
    tenantId: string,
    actor: RequestUser,
    params: { scheduleId: string; shiftDate: string; search?: string },
  ) {
    const actorEmployee = await getActorEmployee(
      this.prisma,
      tenantId,
      actor.id,
    );
    const requesterDate = this.parseDateOnly(params.shiftDate);

    if (!this.isFutureShiftDate(requesterDate)) {
      throw new BadRequestException(
        "Only future shifts can be swapped. Today's shift and past shifts are not eligible.",
      );
    }

    const requesterSchedule = await this.getScheduleForSwap(
      tenantId,
      params.scheduleId,
    );

    if (requesterSchedule.employee.id !== actorEmployee.id) {
      throw new ForbiddenException(
        'You can only request a swap for your own shift',
      );
    }

    if (!this.scheduleAppliesOnDate(requesterSchedule, requesterDate)) {
      throw new BadRequestException(
        'The selected shift does not exist on that date',
      );
    }

    await this.assertNoApprovedLeaveOnDate(
      tenantId,
      actorEmployee.id,
      requesterDate,
      'You cannot request a swap for a shift that falls on approved leave.',
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + this.swapSearchWindowDays);

    const trimmedSearch = params.search?.trim();
    const colleagues = await this.prisma.employee.findMany({
      where: {
        tenantId,
        id: { not: actorEmployee.id },
        employmentStatus: {
          in: [EmploymentStatus.ACTIVE, EmploymentStatus.PROBATION],
        },
        ...(requesterSchedule.employee.managerId
          ? { managerId: requesterSchedule.employee.managerId }
          : requesterSchedule.employee.departmentId
            ? { departmentId: requesterSchedule.employee.departmentId }
            : { id: '__no-team__' }),
        ...(trimmedSearch
          ? {
              OR: [
                { firstName: { contains: trimmedSearch, mode: 'insensitive' } },
                { lastName: { contains: trimmedSearch, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        schedules: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const options: Array<{
      colleagueEmployeeId: string;
      colleagueName: string;
      scheduleId: string;
      shiftDate: string;
      shiftType: string;
      startTime: string;
      endTime: string;
      workMode: string;
    }> = [];

    for (const colleague of colleagues) {
      for (const schedule of colleague.schedules) {
        const occurrences = this.listScheduleOccurrences(
          schedule,
          today,
          windowEnd,
        );

        const hasApprovedLeaveDates = new Set(
          (
            await this.prisma.leaveRequest.findMany({
              where: {
                tenantId,
                employeeId: colleague.id,
                status: 'APPROVED',
                startDate: { lte: windowEnd },
                endDate: { gte: today },
              },
              select: { startDate: true, endDate: true },
            })
          ).flatMap((leave) => {
            const dates: string[] = [];
            const cursor = new Date(leave.startDate);
            cursor.setHours(0, 0, 0, 0);
            const end = new Date(leave.endDate);
            end.setHours(0, 0, 0, 0);
            while (cursor.getTime() <= end.getTime()) {
              dates.push(this.formatDateOnly(cursor));
              cursor.setDate(cursor.getDate() + 1);
            }
            return dates;
          }),
        );

        for (const occurrence of occurrences) {
          const occurrenceDate = this.formatDateOnly(occurrence);
          if (occurrenceDate === this.formatDateOnly(requesterDate)) continue;
          if (hasApprovedLeaveDates.has(occurrenceDate)) continue;
          if (
            await this.hasApprovedLeaveOnDate(
              tenantId,
              actorEmployee.id,
              occurrence,
            )
          ) {
            continue;
          }

          options.push({
            colleagueEmployeeId: colleague.id,
            colleagueName: `${colleague.firstName} ${colleague.lastName}`,
            scheduleId: schedule.id,
            shiftDate: occurrenceDate,
            shiftType: schedule.shiftType,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            workMode: schedule.workMode,
          });
        }
      }
    }

    return options;
  }

  async createShiftSwapRequest(
    tenantId: string,
    actor: RequestUser,
    dto: CreateShiftSwapDto,
  ) {
    const actorEmployee = await getActorEmployee(
      this.prisma,
      tenantId,
      actor.id,
    );
    const requesterDate = this.parseDateOnly(dto.requesterShiftDate);
    const targetDate = this.parseDateOnly(dto.targetShiftDate);

    if (
      !this.isFutureShiftDate(requesterDate) ||
      !this.isFutureShiftDate(targetDate)
    ) {
      throw new BadRequestException(
        "Only future shifts can be swapped. Today's shift and past shifts are not eligible.",
      );
    }

    if (
      this.formatDateOnly(requesterDate) === this.formatDateOnly(targetDate)
    ) {
      throw new BadRequestException(
        'Swap requests must be made against a colleague shift on a different date',
      );
    }

    const [requesterSchedule, targetSchedule] = await Promise.all([
      this.getScheduleForSwap(tenantId, dto.requesterScheduleId),
      this.getScheduleForSwap(tenantId, dto.targetScheduleId),
    ]);

    if (requesterSchedule.employee.id !== actorEmployee.id) {
      throw new ForbiddenException(
        'You can only request a swap for your own shift',
      );
    }

    if (!this.scheduleAppliesOnDate(requesterSchedule, requesterDate)) {
      throw new BadRequestException(
        'Your selected shift does not exist on that date',
      );
    }

    if (!this.scheduleAppliesOnDate(targetSchedule, targetDate)) {
      throw new BadRequestException(
        "The colleague's selected shift does not exist on that date",
      );
    }

    if (
      !this.areSameTeam(requesterSchedule.employee, targetSchedule.employee)
    ) {
      throw new BadRequestException(
        'You can only swap with colleagues in your own team',
      );
    }

    await this.assertNoApprovedLeaveOnDate(
      tenantId,
      actorEmployee.id,
      requesterDate,
      'You cannot request a swap for a shift that falls on approved leave.',
    );
    await this.assertNoApprovedLeaveOnDate(
      tenantId,
      actorEmployee.id,
      targetDate,
      `You have approved leave on ${targetDate.toLocaleDateString('en-GB')} and cannot take this shift.`,
    );
    await this.assertNoApprovedLeaveOnDate(
      tenantId,
      targetSchedule.employee.id,
      targetDate,
      'The selected colleague is on approved leave for their shift and cannot swap at this time.',
    );

    await Promise.all([
      this.ensureNoActiveSwapConflict(
        tenantId,
        requesterSchedule.id,
        requesterDate,
      ),
      this.ensureNoActiveSwapConflict(tenantId, targetSchedule.id, targetDate),
    ]);

    const managerEmployeeId = await this.resolveSwapManagerEmployeeId(
      tenantId,
      requesterSchedule.employee,
      targetSchedule.employee,
    );

    if (!managerEmployeeId) {
      throw new BadRequestException(
        'No manager could be resolved for this team swap request',
      );
    }

    const swap = await this.prisma.shiftSwapRequest.create({
      data: {
        tenantId,
        requesterEmployeeId: requesterSchedule.employee.id,
        requesterScheduleId: requesterSchedule.id,
        requesterShiftDate: requesterDate,
        targetEmployeeId: targetSchedule.employee.id,
        targetScheduleId: targetSchedule.id,
        targetShiftDate: targetDate,
        managerEmployeeId,
        reason: dto.reason?.trim() || null,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
      include: {
        requesterEmployee: {
          select: { firstName: true, lastName: true, userId: true },
        },
        targetEmployee: {
          select: { firstName: true, lastName: true, userId: true },
        },
      },
    });

    const requesterName = `${swap.requesterEmployee.firstName} ${swap.requesterEmployee.lastName}`;
    const targetName = `${swap.targetEmployee.firstName} ${swap.targetEmployee.lastName}`;
    const requesterShift = this.formatShiftForMessage(
      requesterDate,
      requesterSchedule.startTime,
      requesterSchedule.endTime,
    );
    const targetShift = this.formatShiftForMessage(
      targetDate,
      targetSchedule.startTime,
      targetSchedule.endTime,
    );
    const link = `/hr/scheduling?tab=my-schedule`;

    await this.notifyShiftSwapUsers([
      {
        tenantId,
        userId: swap.requesterEmployee.userId,
        type: 'SHIFT_SWAP_REQUESTED',
        message: `Your shift swap request with ${targetName} has been submitted and is awaiting their response.`,
        link,
      },
      {
        tenantId,
        userId: swap.targetEmployee.userId,
        type: 'SHIFT_SWAP_REQUESTED',
        message: `${requesterName} requested a shift swap: ${requesterShift} for ${targetShift}.`,
        link,
      },
    ]);

    return swap;
  }

  async getMyShiftSwapRequests(tenantId: string, actor: RequestUser) {
    const actorEmployee = await getActorEmployee(
      this.prisma,
      tenantId,
      actor.id,
    );

    return this.prisma.shiftSwapRequest.findMany({
      where: {
        tenantId,
        OR: [
          { requesterEmployeeId: actorEmployee.id },
          { targetEmployeeId: actorEmployee.id },
          { managerEmployeeId: actorEmployee.id },
        ],
      },
      include: {
        requesterEmployee: {
          select: { firstName: true, lastName: true },
        },
        targetEmployee: {
          select: { firstName: true, lastName: true },
        },
        requesterSchedule: {
          select: {
            shiftType: true,
            startTime: true,
            endTime: true,
            workMode: true,
          },
        },
        targetSchedule: {
          select: {
            shiftType: true,
            startTime: true,
            endTime: true,
            workMode: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingManagerShiftSwaps(tenantId: string, actor: RequestUser) {
    const actorEmployee = await getActorEmployee(
      this.prisma,
      tenantId,
      actor.id,
    );
    assertHrAccess(
      isCompanyAdminUser(actor) ||
        hasPermissionRule(actor, 'schedules:CREATE') ||
        hasPermissionRule(actor, 'schedules:EDIT'),
    );

    return this.prisma.shiftSwapRequest.findMany({
      where: {
        tenantId,
        managerEmployeeId: actorEmployee.id,
        status: ShiftSwapStatus.PENDING_MANAGER,
      },
      include: {
        requesterEmployee: {
          select: { firstName: true, lastName: true },
        },
        targetEmployee: {
          select: { firstName: true, lastName: true },
        },
        requesterSchedule: true,
        targetSchedule: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getShiftSwapRequest(
    tenantId: string,
    actor: RequestUser,
    shiftSwapId: string,
  ) {
    const actorEmployee = await getActorEmployee(
      this.prisma,
      tenantId,
      actor.id,
    );

    const swap = await this.prisma.shiftSwapRequest.findFirst({
      where: { id: shiftSwapId, tenantId },
      include: {
        requesterEmployee: {
          select: { id: true, firstName: true, lastName: true, userId: true },
        },
        targetEmployee: {
          select: { id: true, firstName: true, lastName: true, userId: true },
        },
        managerEmployee: {
          select: { id: true, firstName: true, lastName: true, userId: true },
        },
        requesterSchedule: true,
        targetSchedule: true,
      },
    });

    if (!swap) {
      throw new NotFoundException('Shift swap request not found');
    }

    assertHrAccess(
      isCompanyAdminUser(actor) ||
        swap.requesterEmployeeId === actorEmployee.id ||
        swap.targetEmployeeId === actorEmployee.id ||
        swap.managerEmployeeId === actorEmployee.id ||
        hasPermissionRule(actor, 'schedules:CREATE') ||
        hasPermissionRule(actor, 'schedules:EDIT'),
    );

    return swap;
  }

  async respondToShiftSwap(
    tenantId: string,
    actor: RequestUser,
    shiftSwapId: string,
    dto: RespondShiftSwapDto,
  ) {
    const actorEmployee = await getActorEmployee(
      this.prisma,
      tenantId,
      actor.id,
    );
    const swap = await this.getShiftSwapRequest(tenantId, actor, shiftSwapId);

    if (swap.targetEmployeeId !== actorEmployee.id) {
      throw new ForbiddenException(
        'Only the selected colleague can respond to this shift swap',
      );
    }

    if (swap.status !== ShiftSwapStatus.PENDING_COLLEAGUE) {
      throw new BadRequestException(
        'This shift swap is no longer awaiting colleague response',
      );
    }

    if (swap.expiresAt.getTime() < Date.now()) {
      await this.prisma.shiftSwapRequest.update({
        where: { id: swap.id },
        data: { status: ShiftSwapStatus.EXPIRED },
      });
      throw new BadRequestException('This shift swap request has expired');
    }

    const requesterName = `${swap.requesterEmployee.firstName} ${swap.requesterEmployee.lastName}`;
    const targetName = `${swap.targetEmployee.firstName} ${swap.targetEmployee.lastName}`;
    const link = `/hr/scheduling?tab=my-schedule`;

    if (dto.action === 'DECLINE') {
      const declined = await this.prisma.shiftSwapRequest.update({
        where: { id: swap.id },
        data: {
          status: ShiftSwapStatus.DECLINED,
          colleagueRespondedAt: new Date(),
        },
      });

      await this.notifyShiftSwapUsers([
        {
          tenantId,
          userId: swap.requesterEmployee.userId,
          type: 'SHIFT_SWAP_DECLINED',
          message: `${targetName} declined your shift swap request.`,
          link,
        },
        {
          tenantId,
          userId: swap.targetEmployee.userId,
          type: 'SHIFT_SWAP_DECLINED',
          message: `You declined the shift swap request from ${requesterName}.`,
          link,
        },
      ]);

      return declined;
    }

    const accepted = await this.prisma.shiftSwapRequest.update({
      where: { id: swap.id },
      data: {
        status: ShiftSwapStatus.PENDING_MANAGER,
        colleagueRespondedAt: new Date(),
      },
    });

    await this.notifyShiftSwapUsers([
      {
        tenantId,
        userId: swap.requesterEmployee.userId,
        type: 'SHIFT_SWAP_PENDING_MANAGER',
        message: `${targetName} accepted your shift swap request. It is now awaiting manager approval.`,
        link,
      },
      {
        tenantId,
        userId: swap.targetEmployee.userId,
        type: 'SHIFT_SWAP_PENDING_MANAGER',
        message: `You accepted the shift swap request from ${requesterName}. It is now awaiting manager approval.`,
        link,
      },
      {
        tenantId,
        userId: swap.managerEmployee?.userId,
        type: 'SHIFT_SWAP_PENDING_MANAGER',
        message: `A shift swap between ${requesterName} and ${targetName} is awaiting your approval.`,
        link: '/hr/scheduling?tab=swap-requests',
      },
    ]);

    return accepted;
  }

  async reviewShiftSwap(
    tenantId: string,
    actor: RequestUser,
    shiftSwapId: string,
    dto: ReviewShiftSwapDto,
  ) {
    const actorEmployee = await getActorEmployee(
      this.prisma,
      tenantId,
      actor.id,
    );
    const swap = await this.getShiftSwapRequest(tenantId, actor, shiftSwapId);

    assertHrAccess(
      isCompanyAdminUser(actor) ||
        swap.managerEmployeeId === actorEmployee.id ||
        hasPermissionRule(actor, 'schedules:CREATE') ||
        hasPermissionRule(actor, 'schedules:EDIT'),
    );

    if (swap.status !== ShiftSwapStatus.PENDING_MANAGER) {
      throw new BadRequestException(
        'This shift swap is not awaiting manager approval',
      );
    }

    const requesterName = `${swap.requesterEmployee.firstName} ${swap.requesterEmployee.lastName}`;
    const targetName = `${swap.targetEmployee.firstName} ${swap.targetEmployee.lastName}`;
    const link = `/hr/scheduling?tab=my-schedule`;

    if (dto.action === 'REJECT') {
      if (!dto.reason?.trim()) {
        throw new BadRequestException('A rejection reason is required');
      }

      const rejected = await this.prisma.shiftSwapRequest.update({
        where: { id: swap.id },
        data: {
          status: ShiftSwapStatus.REJECTED,
          managerDecisionAt: new Date(),
          managerRejectionReason: dto.reason.trim(),
        },
      });

      await this.notifyShiftSwapUsers([
        {
          tenantId,
          userId: swap.requesterEmployee.userId,
          type: 'SHIFT_SWAP_REJECTED',
          message: `Your shift swap request with ${targetName} was rejected. Reason: ${dto.reason.trim()}`,
          link,
        },
        {
          tenantId,
          userId: swap.targetEmployee.userId,
          type: 'SHIFT_SWAP_REJECTED',
          message: `The shift swap request with ${requesterName} was rejected. Reason: ${dto.reason.trim()}`,
          link,
        },
      ]);

      return rejected;
    }

    const approved = await this.prisma.$transaction(async (tx) => {
      await tx.shiftAssignmentOverride.upsert({
        where: {
          scheduleId_shiftDate: {
            scheduleId: swap.requesterScheduleId,
            shiftDate: swap.requesterShiftDate,
          },
        },
        create: {
          tenantId,
          scheduleId: swap.requesterScheduleId,
          shiftDate: swap.requesterShiftDate,
          assignedEmployeeId: swap.targetEmployeeId,
          swapRequestId: swap.id,
        },
        update: {
          assignedEmployeeId: swap.targetEmployeeId,
          swapRequestId: swap.id,
        },
      });

      await tx.shiftAssignmentOverride.upsert({
        where: {
          scheduleId_shiftDate: {
            scheduleId: swap.targetScheduleId,
            shiftDate: swap.targetShiftDate,
          },
        },
        create: {
          tenantId,
          scheduleId: swap.targetScheduleId,
          shiftDate: swap.targetShiftDate,
          assignedEmployeeId: swap.requesterEmployeeId,
          swapRequestId: swap.id,
        },
        update: {
          assignedEmployeeId: swap.requesterEmployeeId,
          swapRequestId: swap.id,
        },
      });

      return tx.shiftSwapRequest.update({
        where: { id: swap.id },
        data: {
          status: ShiftSwapStatus.APPROVED,
          managerDecisionAt: new Date(),
        },
      });
    });

    await this.notifyShiftSwapUsers([
      {
        tenantId,
        userId: swap.requesterEmployee.userId,
        type: 'SHIFT_SWAP_APPROVED',
        message: `Your shift swap request with ${targetName} was approved.`,
        link,
      },
      {
        tenantId,
        userId: swap.targetEmployee.userId,
        type: 'SHIFT_SWAP_APPROVED',
        message: `The shift swap request with ${requesterName} was approved.`,
        link,
      },
    ]);

    return approved;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expirePendingShiftSwapRequests() {
    const expiredRequests = await this.prisma.shiftSwapRequest.findMany({
      where: {
        status: ShiftSwapStatus.PENDING_COLLEAGUE,
        expiresAt: { lt: new Date() },
      },
      include: {
        requesterEmployee: {
          select: { firstName: true, lastName: true, userId: true },
        },
        targetEmployee: {
          select: { firstName: true, lastName: true, userId: true },
        },
      },
    });

    if (!expiredRequests.length) return;

    await this.prisma.shiftSwapRequest.updateMany({
      where: {
        id: { in: expiredRequests.map((request) => request.id) },
      },
      data: { status: ShiftSwapStatus.EXPIRED },
    });

    for (const request of expiredRequests) {
      const requesterName = `${request.requesterEmployee.firstName} ${request.requesterEmployee.lastName}`;
      const targetName = `${request.targetEmployee.firstName} ${request.targetEmployee.lastName}`;
      await this.notifyShiftSwapUsers([
        {
          tenantId: request.tenantId,
          userId: request.requesterEmployee.userId,
          type: 'SHIFT_SWAP_EXPIRED',
          message: `Your shift swap request with ${targetName} expired without a response.`,
          link: '/hr/scheduling?tab=my-schedule',
        },
        {
          tenantId: request.tenantId,
          userId: request.targetEmployee.userId,
          type: 'SHIFT_SWAP_EXPIRED',
          message: `The shift swap request from ${requesterName} expired without a response.`,
          link: '/hr/scheduling?tab=my-schedule',
        },
      ]);
    }
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

    const [
      schedules,
      leaveRequests,
      publicHolidays,
      assignmentOverrides,
      shiftSwaps,
    ] = await Promise.all([
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
      this.prisma.shiftAssignmentOverride.findMany({
        where: {
          tenantId,
          assignedEmployeeId: actorEmployee.id,
          ...(fromDate && { shiftDate: { gte: fromDate } }),
          ...(toDate && { shiftDate: { lte: toDate } }),
        },
        include: {
          schedule: {
            select: {
              id: true,
              shiftType: true,
              startTime: true,
              endTime: true,
              workMode: true,
            },
          },
        },
        orderBy: { shiftDate: 'asc' },
      }),
      this.prisma.shiftSwapRequest.findMany({
        where: {
          tenantId,
          AND: [
            {
              OR: [
                { requesterEmployeeId: actorEmployee.id },
                { targetEmployeeId: actorEmployee.id },
              ],
            },
            ...(fromDate
              ? [
                  {
                    OR: [
                      { requesterShiftDate: { gte: fromDate } },
                      { targetShiftDate: { gte: fromDate } },
                    ],
                  },
                ]
              : []),
            ...(toDate
              ? [
                  {
                    OR: [
                      { requesterShiftDate: { lte: toDate } },
                      { targetShiftDate: { lte: toDate } },
                    ],
                  },
                ]
              : []),
          ],
        },
        select: {
          id: true,
          requesterEmployeeId: true,
          targetEmployeeId: true,
          requesterScheduleId: true,
          requesterShiftDate: true,
          targetScheduleId: true,
          targetShiftDate: true,
          status: true,
          expiresAt: true,
        },
        orderBy: { createdAt: 'desc' },
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
      assignmentOverrides: assignmentOverrides.map((override) => ({
        id: override.id,
        scheduleId: override.scheduleId,
        shiftDate: this.formatDateOnly(override.shiftDate),
        shiftType: override.schedule.shiftType,
        startTime: override.schedule.startTime,
        endTime: override.schedule.endTime,
        workMode: override.schedule.workMode,
      })),
      shiftSwaps: shiftSwaps.map((swap) => ({
        id: swap.id,
        role:
          swap.requesterEmployeeId === actorEmployee.id
            ? 'REQUESTER'
            : 'COLLEAGUE',
        requesterScheduleId: swap.requesterScheduleId,
        requesterShiftDate: this.formatDateOnly(swap.requesterShiftDate),
        targetScheduleId: swap.targetScheduleId,
        targetShiftDate: this.formatDateOnly(swap.targetShiftDate),
        status: swap.status,
        expiresAt: swap.expiresAt.toISOString(),
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
