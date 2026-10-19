import { Injectable } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { AnnouncementsService } from '../announcements/announcements.service';
import { PrismaService } from '../prisma/prisma.service';
import { AvatarUrlResolverService } from '../common/avatar-url-resolver.service';
import { DashboardKpis, QueryDashboardKpisDto } from './dto/dashboard-kpis.dto';

const DAY_MS = 86_400_000;

export type RecentActivityType =
  | 'HIRED'
  | 'STATUS_CHANGED'
  | 'OFFBOARDED'
  | 'OFFBOARDING_INITIATED'
  | 'RESIGNATION_SUBMITTED'
  | 'RESIGNATION_WITHDRAWN'
  | 'RESIGNATION_DISMISSED'
  | 'LEAVE_APPROVED'
  | 'LEAVE_REJECTED'
  | 'TIME_CORRECTION_APPROVED'
  | 'TIME_CORRECTION_REJECTED';

export interface RecentActivityEvent {
  id: string;
  type: RecentActivityType;
  employeeId: string;
  employeeName: string;
  /** Job title, new status, leave type and days, and so on, depending on `type`. */
  detail: string | null;
  /** Email of who did it, when the record keeps one. */
  actor: string | null;
  timestamp: Date;
}

/** How far ahead probation and contract end dates are flagged on the dashboard. */
const ENDING_SOON_DAYS = 30;

export interface PendingActions {
  leaveRequests: number;
  timeCorrections: number;
  shiftSwaps: number;
  resignations: number;
  payrollApprovals: number;
  appraisalFinalizations: number;
  probationEnding: number;
  contractsEnding: number;
  /** The look-ahead, in days, used for `probationEnding` and `contractsEnding`. */
  endingWithinDays: number;
}

export type UpcomingEventType =
  | 'BIRTHDAY'
  | 'WORK_ANNIVERSARY'
  | 'PROBATION_ENDS'
  | 'CONTRACT_ENDS';

export interface UpcomingEvent {
  id: string;
  type: UpcomingEventType;
  employeeId: string;
  employeeName: string;
  department: string | null;
  avatarUrl: string | null;
  /** The day it happens, as YYYY-MM-DD. */
  date: string;
  /** Years of service for an anniversary; null for the other types. */
  years: number | null;
}

export interface OutTodayEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string | null;
  avatarUrl: string | null;
  leaveType: string;
  /** Last day of the leave, as YYYY-MM-DD. */
  endDate: string;
}

export interface PayrollStatusRun {
  id: string;
  /** The payslip type the run is for; "legacy" for runs made by the old calculators. */
  payslipKey: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PAID';
  totalNet: number;
  employees: number;
}

export interface PayrollStatus {
  /** The most recent period that has a run, or null when none exists yet. */
  period: { month: number; year: number } | null;
  currency: string;
  runs: PayrollStatusRun[];
}

/** How far ahead the upcoming-events list looks, and how many events it returns. */
const UPCOMING_EVENT_DAYS = 30;
const UPCOMING_EVENT_LIMIT = 12;

type DayRange = { from: Date; to: Date };
type KpiEmployee = {
  id: string;
  hireDate: Date;
  offboardedAt: Date | null;
  employmentStatus: string;
};
type LeaveSpan = { start: number; end: number };

const startOfDay = (value: string) => new Date(`${value}T00:00:00.000Z`);
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const percent = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly announcementsService: AnnouncementsService,
    private readonly avatarUrlResolver: AvatarUrlResolverService,
  ) {}

  async getSummary(
    tenantId: string,
    tenantSlug: string,
    firstName: string,
    tenantName: string,
  ) {
    const [
      totalEmployees,
      activeEmployees,
      pendingLeaveRequests,
      assignedAssetsCount,
    ] = await Promise.all([
      this.prisma.employee.count({ where: { tenantId } }),
      this.prisma.employee.count({
        where: { tenantId, employmentStatus: 'ACTIVE' },
      }),
      this.prisma.leaveRequest.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.prisma.asset.count({
        where: {
          tenantId,
          isActive: true,
          status: 'ASSIGNED',
        },
      }),
    ]);

    return {
      adminFirstName: firstName,
      companyName: tenantName,
      totalEmployees,
      activeEmployees,
      pendingLeaveRequests,
      assignedAssetsCount,
      hasEmployees: totalEmployees > 0,
      modules: {
        hr: { enabled: true, locked: false },
        payroll: { enabled: true, locked: false },
        assets: { enabled: true, locked: false },
        recruitment: { enabled: false, locked: true },
      },
    };
  }

  /**
   * Headline figures for the HR dashboard row. Ranges are whole days, inclusive. Days after
   * today are never counted, so a half-finished period is not measured as if it had ended.
   * Attendance assumes a Monday to Friday working week and excludes employees on approved leave
   * from the days they are expected; offboarded employees count through their last working day.
   */
  async getKpis(
    tenantId: string,
    query: QueryDashboardKpisDto,
  ): Promise<DashboardKpis> {
    const current: DayRange = {
      from: startOfDay(query.fromDate),
      to: startOfDay(query.toDate),
    };
    const previous: DayRange = {
      from: startOfDay(query.prevFromDate),
      to: startOfDay(query.prevToDate),
    };
    const earliest = new Date(
      Math.min(current.from.getTime(), previous.from.getTime()),
    );
    const today = startOfDay(dayKey(new Date()));
    const afterCurrent = new Date(current.to.getTime() + DAY_MS);

    const [employees, leaves, clocks, pending] = await Promise.all([
      this.prisma.employee.findMany({
        where: {
          tenantId,
          hireDate: { lt: afterCurrent },
          OR: [{ offboardedAt: null }, { offboardedAt: { gte: earliest } }],
        },
        select: {
          id: true,
          hireDate: true,
          offboardedAt: true,
          employmentStatus: true,
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          tenantId,
          status: 'APPROVED',
          startDate: { lt: afterCurrent },
          endDate: { gte: earliest },
        },
        select: { employeeId: true, startDate: true, endDate: true },
      }),
      this.prisma.clockRecord.findMany({
        where: { tenantId, date: { gte: earliest, lt: afterCurrent } },
        select: { employeeId: true, date: true, isLate: true },
      }),
      this.prisma.leaveRequest.count({
        where: { tenantId, status: 'PENDING' },
      }),
    ]);

    const employedOn = (e: KpiEmployee, day: Date) =>
      e.hireDate.getTime() < day.getTime() + DAY_MS &&
      (!e.offboardedAt || e.offboardedAt.getTime() >= day.getTime());
    const headcountOn = (day: Date) =>
      employees.filter((e) => employedOn(e, day)).length;
    const capped = (day: Date) => (day > today ? today : day);

    const spansByEmployee = new Map<string, LeaveSpan[]>();
    for (const leave of leaves) {
      const spans = spansByEmployee.get(leave.employeeId) ?? [];
      spans.push({
        start: leave.startDate.getTime(),
        end: leave.endDate.getTime(),
      });
      spansByEmployee.set(leave.employeeId, spans);
    }
    const onLeaveOn = (employeeId: string, day: Date) =>
      (spansByEmployee.get(employeeId) ?? []).some(
        (s) => s.start < day.getTime() + DAY_MS && s.end >= day.getTime(),
      );

    const present = new Set<string>();
    for (const c of clocks) present.add(`${c.employeeId}|${dayKey(c.date)}`);

    const attendance = (range: DayRange) => {
      const last = capped(range.to);
      let expected = 0;
      let attended = 0;
      for (
        let day = range.from;
        day.getTime() <= last.getTime();
        day = new Date(day.getTime() + DAY_MS)
      ) {
        const weekday = day.getUTCDay();
        if (weekday === 0 || weekday === 6) continue;
        const key = dayKey(day);
        for (const e of employees) {
          if (!employedOn(e, day) || onLeaveOn(e.id, day)) continue;
          expected += 1;
          if (present.has(`${e.id}|${key}`)) attended += 1;
        }
      }
      return { expected, attended };
    };

    const leaveCount = (range: DayRange) => {
      const end = range.to.getTime() + DAY_MS;
      const ids = new Set<string>();
      for (const [employeeId, spans] of spansByEmployee) {
        if (spans.some((s) => s.start < end && s.end >= range.from.getTime()))
          ids.add(employeeId);
      }
      return ids.size;
    };

    const movement = (range: DayRange) => {
      const end = range.to.getTime() + DAY_MS;
      const inside = (at: Date | null) =>
        !!at && at.getTime() >= range.from.getTime() && at.getTime() < end;
      const hires = employees.filter((e) => inside(e.hireDate)).length;
      const exits = employees.filter((e) => inside(e.offboardedAt)).length;
      const average =
        (headcountOn(range.from) + headcountOn(capped(range.to))) / 2;
      return { hires, exits, turnoverRate: percent(exits, average) };
    };

    const currentHeadcount = employees.filter((e) =>
      employedOn(e, capped(current.to)),
    );
    const currentAttendance = attendance(current);
    const previousAttendance = attendance(previous);
    const currentMovement = movement(current);
    const previousMovement = movement(previous);
    const currentLate = new Set(
      clocks
        .filter(
          (c) =>
            c.isLate &&
            c.date.getTime() >= current.from.getTime() &&
            c.date.getTime() <= current.to.getTime(),
        )
        .map((c) => `${c.employeeId}|${dayKey(c.date)}`),
    );

    return {
      headcount: {
        current: currentHeadcount.length,
        previous: headcountOn(capped(previous.to)),
        onProbation: currentHeadcount.filter(
          (e) => e.employmentStatus === 'PROBATION',
        ).length,
        suspended: currentHeadcount.filter(
          (e) => e.employmentStatus === 'SUSPENDED',
        ).length,
      },
      attendance: {
        rate: percent(currentAttendance.attended, currentAttendance.expected),
        previousRate: percent(
          previousAttendance.attended,
          previousAttendance.expected,
        ),
        late: currentLate.size,
        absent: Math.max(
          currentAttendance.expected - currentAttendance.attended,
          0,
        ),
      },
      onLeave: {
        current: leaveCount(current),
        previous: leaveCount(previous),
        today: leaveCount({ from: today, to: today }),
        pending,
      },
      hiresAndExits: {
        hires: currentMovement.hires,
        previousHires: previousMovement.hires,
        exits: currentMovement.exits,
        previousExits: previousMovement.exits,
        turnoverRate: currentMovement.turnoverRate,
        previousTurnoverRate: previousMovement.turnoverRate,
      },
    };
  }

  async getEmployeeDashboard(tenantId: string, actor: RequestUser) {
    // Get employee profile
    const employee = await this.prisma.employee.findFirst({
      where: { userId: actor.id, tenantId },
      include: { department: true },
    });

    // Get today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAttendance = employee
      ? await this.prisma.clockRecord.findFirst({
          where: {
            employeeId: employee.id,
            date: { gte: today, lt: tomorrow },
          },
        })
      : null;

    // Get leave balances
    const leaveBalances = employee
      ? await this.prisma.leaveBalance.findMany({
          where: { employeeId: employee.id, tenantId },
          include: { leaveType: true },
        })
      : [];

    // Get upcoming approved leave
    const upcomingLeave = employee
      ? await this.prisma.leaveRequest.findFirst({
          where: {
            employeeId: employee.id,
            tenantId,
            status: 'APPROVED',
            startDate: { gte: new Date() },
          },
          include: { leaveType: true },
          orderBy: { startDate: 'asc' },
        })
      : null;

    // Get pending leave count
    const pendingLeaveCount = employee
      ? await this.prisma.leaveRequest.count({
          where: {
            employeeId: employee.id,
            tenantId,
            status: 'PENDING',
          },
        })
      : 0;

    // Get last 3 announcements
    const announcements =
      await this.announcementsService.findVisibleForDashboard(tenantId, actor);

    const isProfileIncomplete =
      employee && (!employee.jobTitle || !employee.departmentId);
    const resolvedAvatarUrl = await this.avatarUrlResolver.resolve(
      employee?.avatarUrl,
    );

    return {
      profile: {
        fullName: employee
          ? `${employee.firstName} ${employee.lastName}`
          : 'Name not set',
        jobTitle: employee?.jobTitle ?? 'No title assigned',
        department: employee?.department?.name ?? 'No department assigned',
        avatarUrl: resolvedAvatarUrl,
        isProfileIncomplete: !!isProfileIncomplete,
      },
      attendance: {
        clockedInAt: todayAttendance?.clockIn ?? null,
        clockedOutAt: todayAttendance?.clockOut ?? null,
        totalHours: todayAttendance?.hoursWorked ?? null,
        status: !todayAttendance
          ? 'NOT_CLOCKED_IN'
          : todayAttendance.clockOut
            ? 'CLOCKED_OUT'
            : 'CLOCKED_IN',
      },
      leave: {
        balances: leaveBalances.map((b) => ({
          leaveType: b.leaveType.name,
          remaining: b.remainingDays,
          total: b.leaveType.daysAllowed,
        })),
        upcomingLeave: upcomingLeave
          ? {
              startDate: upcomingLeave.startDate,
              endDate: upcomingLeave.endDate,
              leaveType: upcomingLeave.leaveType.name,
            }
          : null,
        pendingCount: pendingLeaveCount,
      },
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        preview: a.body.substring(0, 100),
        body: a.body,
        publishedAt: a.publishedAt,
        isRead: a.isRead,
        readAt: a.readAt,
      })),
    };
  }

  /** Current employees per active department, with a gender split; offboarded staff are left
   * out. Employees without a department are reported as "Unassigned" when there are any.
   * Gender not given, or "prefer not to say", is counted as `unspecified`. */
  async getDepartmentDistribution(tenantId: string) {
    const [departments, grouped] = await Promise.all([
      this.prisma.department.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.employee.groupBy({
        by: ['departmentId', 'gender'],
        where: { tenantId, employmentStatus: { not: 'OFFBOARDED' } },
        _count: { _all: true },
      }),
    ]);

    const emptyGender = () => ({
      male: 0,
      female: 0,
      other: 0,
      unspecified: 0,
    });
    const byDepartment = new Map<
      string | null,
      { count: number; gender: ReturnType<typeof emptyGender> }
    >();
    for (const g of grouped) {
      const entry = byDepartment.get(g.departmentId) ?? {
        count: 0,
        gender: emptyGender(),
      };
      const n = g._count._all;
      entry.count += n;
      if (g.gender === 'MALE') entry.gender.male += n;
      else if (g.gender === 'FEMALE') entry.gender.female += n;
      else if (g.gender === 'OTHER') entry.gender.other += n;
      else entry.gender.unspecified += n;
      byDepartment.set(g.departmentId, entry);
    }

    const entryFor = (departmentId: string | null, department: string) => {
      const found = byDepartment.get(departmentId);
      return {
        department,
        count: found?.count ?? 0,
        gender: found?.gender ?? emptyGender(),
      };
    };
    const distribution = departments.map((d) => entryFor(d.id, d.name));
    if ((byDepartment.get(null)?.count ?? 0) > 0) {
      distribution.push(entryFor(null, 'Unassigned'));
    }

    return {
      distribution,
      hasData: distribution.some((d) => d.count > 0),
    };
  }

  /**
   * The latest HR events, newest first, merged from the employee record, completed
   * offboardings, resignations, leave decisions and time-correction decisions. Each event is
   * dated by when it happened, not by when its record was last touched. Leave and time-correction
   * reviewers are stored as user ids only, so those events carry no actor name.
   */
  /** Counts of things waiting on HR: approvals, reviews, and employment dates coming up. */
  async getPendingActions(tenantId: string): Promise<PendingActions> {
    const today = new Date(
      `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
    );
    const horizon = new Date(today.getTime() + ENDING_SOON_DAYS * 86_400_000);
    const stillEmployed = { not: 'OFFBOARDED' as const };

    const [
      leaveRequests,
      timeCorrections,
      shiftSwaps,
      resignations,
      payrollApprovals,
      appraisalFinalizations,
      probationEnding,
      contractsEnding,
    ] = await Promise.all([
      this.prisma.leaveRequest.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.prisma.timeCorrection.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.prisma.shiftSwapRequest.count({
        where: { tenantId, status: 'PENDING_MANAGER' },
      }),
      this.prisma.resignationRecord.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.prisma.payrollRun.count({
        where: { tenantId, status: 'PENDING_APPROVAL' },
      }),
      this.prisma.appraisal.count({
        where: { tenantId, status: 'PENDING_FINALIZATION' },
      }),
      this.prisma.employee.count({
        where: {
          tenantId,
          employmentStatus: 'PROBATION',
          probationEndsAt: { gte: today, lte: horizon },
        },
      }),
      this.prisma.employee.count({
        where: {
          tenantId,
          employmentStatus: stillEmployed,
          contractEndDate: { gte: today, lte: horizon },
        },
      }),
    ]);

    return {
      leaveRequests,
      timeCorrections,
      shiftSwaps,
      resignations,
      payrollApprovals,
      appraisalFinalizations,
      probationEnding,
      contractsEnding,
      endingWithinDays: ENDING_SOON_DAYS,
    };
  }

  async getRecentActivity(tenantId: string, limit = 10) {
    const take = limit * 3;
    const person = { select: { id: true, firstName: true, lastName: true } };
    type Person = { id: string; firstName: string; lastName: string };
    const events: RecentActivityEvent[] = [];
    const add = (
      id: string,
      type: RecentActivityType,
      employee: Person,
      timestamp: Date | null,
      extra: { detail?: string | null; actor?: string | null } = {},
    ) => {
      if (!timestamp) return;
      events.push({
        id,
        type,
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        detail: extra.detail ?? null,
        actor: extra.actor ?? null,
        timestamp,
      });
    };

    const [
      hires,
      statusChanges,
      offboardings,
      resignations,
      leaveDecisions,
      corrections,
    ] = await Promise.all([
      this.prisma.employee.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          createdAt: true,
        },
      }),
      this.prisma.employee.findMany({
        where: {
          tenantId,
          statusChangedAt: { not: null },
          employmentStatus: { not: 'OFFBOARDED' },
        },
        orderBy: { statusChangedAt: 'desc' },
        take,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employmentStatus: true,
          createdAt: true,
          statusChangedAt: true,
          statusChangedByEmail: true,
        },
      }),
      this.prisma.offboardingRecord.findMany({
        where: { tenantId, isDraft: false, completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          reason: true,
          completedAt: true,
          completedByEmail: true,
          employee: person,
        },
      }),
      this.prisma.resignationRecord.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take,
        select: {
          id: true,
          submittedAt: true,
          withdrawnAt: true,
          dismissedAt: true,
          dismissedByEmail: true,
          offboardingInitiatedAt: true,
          employee: person,
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: { tenantId, status: { in: ['APPROVED', 'REJECTED'] } },
        orderBy: { updatedAt: 'desc' },
        take,
        select: {
          id: true,
          status: true,
          totalDays: true,
          approvedAt: true,
          rejectedAt: true,
          leaveType: { select: { name: true } },
          employee: person,
        },
      }),
      this.prisma.timeCorrection.findMany({
        where: {
          tenantId,
          status: { in: ['APPROVED', 'REJECTED'] },
          reviewedAt: { not: null },
        },
        orderBy: { reviewedAt: 'desc' },
        take,
        select: {
          id: true,
          status: true,
          date: true,
          reviewedAt: true,
          employee: person,
        },
      }),
    ]);

    for (const e of hires) {
      add(`hire-${e.id}`, 'HIRED', e, e.createdAt, { detail: e.jobTitle });
    }
    for (const e of statusChanges) {
      // A status stamped when the employee was created is not a change.
      if (!e.statusChangedAt || e.statusChangedAt <= e.createdAt) continue;
      add(
        `status-${e.id}-${e.statusChangedAt.getTime()}`,
        'STATUS_CHANGED',
        e,
        e.statusChangedAt,
        {
          detail: e.employmentStatus,
          actor: e.statusChangedByEmail,
        },
      );
    }
    for (const o of offboardings) {
      add(`offboarded-${o.id}`, 'OFFBOARDED', o.employee, o.completedAt, {
        detail: o.reason,
        actor: o.completedByEmail,
      });
    }
    for (const r of resignations) {
      add(
        `resignation-${r.id}`,
        'RESIGNATION_SUBMITTED',
        r.employee,
        r.submittedAt,
      );
      add(
        `resignation-withdrawn-${r.id}`,
        'RESIGNATION_WITHDRAWN',
        r.employee,
        r.withdrawnAt,
      );
      add(
        `resignation-dismissed-${r.id}`,
        'RESIGNATION_DISMISSED',
        r.employee,
        r.dismissedAt,
        {
          actor: r.dismissedByEmail,
        },
      );
      add(
        `resignation-offboarding-${r.id}`,
        'OFFBOARDING_INITIATED',
        r.employee,
        r.offboardingInitiatedAt,
      );
    }
    for (const l of leaveDecisions) {
      const approved = l.status === 'APPROVED';
      add(
        `leave-${l.id}`,
        approved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
        l.employee,
        approved ? l.approvedAt : l.rejectedAt,
        {
          detail: `${l.leaveType.name} · ${l.totalDays} ${l.totalDays === 1 ? 'day' : 'days'}`,
        },
      );
    }
    for (const c of corrections) {
      add(
        `correction-${c.id}`,
        c.status === 'APPROVED'
          ? 'TIME_CORRECTION_APPROVED'
          : 'TIME_CORRECTION_REJECTED',
        c.employee,
        c.reviewedAt,
        { detail: c.date.toISOString().slice(0, 10) },
      );
    }

    return {
      activity: events
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit),
    };
  }

  async getUpcomingBirthdays(tenantId: string) {
    const today = new Date();
    const in30Days = new Date();
    in30Days.setDate(today.getDate() + 30);

    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        dateOfBirth: { not: null },
        employmentStatus: { in: ['ACTIVE', 'PROBATION'] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        department: { select: { name: true } },
        avatarUrl: true,
      },
    });

    const upcoming = employees
      .filter((e) => {
        if (!e.dateOfBirth) return false;
        const bday = new Date(e.dateOfBirth);
        const bdayThisYear = new Date(
          today.getFullYear(),
          bday.getMonth(),
          bday.getDate(),
        );
        if (bdayThisYear < today) {
          bdayThisYear.setFullYear(today.getFullYear() + 1);
        }
        return bdayThisYear <= in30Days;
      })
      .map((e) => {
        const bday = new Date(e.dateOfBirth!);
        const bdayThisYear = new Date(
          today.getFullYear(),
          bday.getMonth(),
          bday.getDate(),
        );
        if (bdayThisYear < today) {
          bdayThisYear.setFullYear(today.getFullYear() + 1);
        }
        return {
          id: e.id,
          name: `${e.firstName} ${e.lastName}`,
          department: e.department?.name ?? 'No department',
          dateOfBirth: e.dateOfBirth,
          upcomingBirthday: bdayThisYear,
          avatarUrl: e.avatarUrl,
        };
      })
      .sort(
        (a, b) => a.upcomingBirthday.getTime() - b.upcomingBirthday.getTime(),
      )
      .slice(0, 5);

    const avatarUrls = await this.avatarUrlResolver.resolveMany(
      upcoming.map((e) => e.avatarUrl),
    );

    return {
      birthdays: upcoming.map((e, index) => ({
        ...e,
        avatarUrl: avatarUrls[index],
      })),
    };
  }

  /** The next occurrence of a yearly date (month and day of `origin`) on or after `today`. */
  private nextYearly(origin: Date, today: Date): Date {
    const month = origin.getUTCMonth();
    const day = origin.getUTCDate();
    let next = new Date(Date.UTC(today.getUTCFullYear(), month, day));
    if (next < today) {
      next = new Date(Date.UTC(today.getUTCFullYear() + 1, month, day));
    }
    return next;
  }

  async getUpcomingEvents(tenantId: string): Promise<{
    events: UpcomingEvent[];
    withinDays: number;
  }> {
    const today = startOfDay(dayKey(new Date()));
    const horizon = new Date(today.getTime() + UPCOMING_EVENT_DAYS * DAY_MS);
    const stillEmployed = { not: 'OFFBOARDED' as const };

    const person = {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      department: { select: { name: true } },
    } as const;

    const [yearly, probations, contracts] = await Promise.all([
      this.prisma.employee.findMany({
        where: { tenantId, employmentStatus: { in: ['ACTIVE', 'PROBATION'] } },
        select: { ...person, dateOfBirth: true, hireDate: true },
      }),
      this.prisma.employee.findMany({
        where: {
          tenantId,
          employmentStatus: 'PROBATION',
          probationEndsAt: { gte: today, lte: horizon },
        },
        select: { ...person, probationEndsAt: true },
      }),
      this.prisma.employee.findMany({
        where: {
          tenantId,
          employmentStatus: stillEmployed,
          contractEndDate: { gte: today, lte: horizon },
        },
        select: { ...person, contractEndDate: true },
      }),
    ]);

    type Row = Omit<UpcomingEvent, 'avatarUrl'> & { avatar: string | null };
    const rows: Row[] = [];
    const push = (
      e: {
        id: string;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
        department: { name: string } | null;
      },
      type: UpcomingEventType,
      date: Date,
      years: number | null = null,
    ) =>
      rows.push({
        id: `${type}:${e.id}`,
        type,
        employeeId: e.id,
        employeeName: `${e.firstName} ${e.lastName}`,
        department: e.department?.name ?? null,
        avatar: e.avatarUrl,
        date: dayKey(date),
        years,
      });

    for (const e of yearly) {
      if (e.dateOfBirth) {
        const next = this.nextYearly(e.dateOfBirth, today);
        if (next <= horizon) push(e, 'BIRTHDAY', next);
      }
      const anniversary = this.nextYearly(e.hireDate, today);
      const years = anniversary.getUTCFullYear() - e.hireDate.getUTCFullYear();
      // The hire day itself is not an anniversary.
      if (years >= 1 && anniversary <= horizon) {
        push(e, 'WORK_ANNIVERSARY', anniversary, years);
      }
    }
    for (const e of probations) push(e, 'PROBATION_ENDS', e.probationEndsAt!);
    for (const e of contracts) push(e, 'CONTRACT_ENDS', e.contractEndDate!);

    rows.sort((a, b) => a.date.localeCompare(b.date));
    const top = rows.slice(0, UPCOMING_EVENT_LIMIT);
    const avatarUrls = await this.avatarUrlResolver.resolveMany(
      top.map((r) => r.avatar),
    );

    return {
      events: top.map(({ avatar: _avatar, ...rest }, index) => ({
        ...rest,
        avatarUrl: avatarUrls[index] ?? null,
      })),
      withinDays: UPCOMING_EVENT_DAYS,
    };
  }

  async getOutToday(tenantId: string): Promise<{ out: OutTodayEntry[] }> {
    const today = startOfDay(dayKey(new Date()));

    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today },
        employee: { employmentStatus: { not: 'OFFBOARDED' } },
      },
      orderBy: [{ endDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        endDate: true,
        leaveType: { select: { name: true } },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    const avatarUrls = await this.avatarUrlResolver.resolveMany(
      requests.map((r) => r.employee.avatarUrl),
    );

    return {
      out: requests.map((r, index) => ({
        id: r.id,
        employeeId: r.employee.id,
        employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
        department: r.employee.department?.name ?? null,
        avatarUrl: avatarUrls[index] ?? null,
        leaveType: r.leaveType.name,
        endDate: dayKey(r.endDate),
      })),
    };
  }

  async getPayrollStatus(tenantId: string): Promise<PayrollStatus> {
    const latest = await this.prisma.payrollRun.findFirst({
      where: { tenantId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      select: { month: true, year: true },
    });
    if (!latest) return { period: null, currency: 'GHS', runs: [] };

    const runs = await this.prisma.payrollRun.findMany({
      where: { tenantId, month: latest.month, year: latest.year },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        payslipKey: true,
        status: true,
        totalNet: true,
        payrollCurrency: true,
        _count: { select: { items: true } },
      },
    });

    return {
      period: latest,
      currency: runs[0]?.payrollCurrency ?? 'GHS',
      runs: runs.map((r) => ({
        id: r.id,
        payslipKey: r.payslipKey,
        status: r.status,
        totalNet: Number(r.totalNet),
        employees: r._count.items,
      })),
    };
  }

  async getRecentlyAdded(tenantId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        createdAt: true,
        avatarUrl: true,
        department: { select: { name: true } },
      },
    });

    const avatarUrls = await this.avatarUrlResolver.resolveMany(
      employees.map((e) => e.avatarUrl),
    );

    return {
      employees: employees.map((e, index) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        jobTitle: e.jobTitle,
        department: e.department?.name ?? 'No department',
        dateAdded: e.createdAt,
        avatarUrl: avatarUrls[index],
      })),
    };
  }
}
