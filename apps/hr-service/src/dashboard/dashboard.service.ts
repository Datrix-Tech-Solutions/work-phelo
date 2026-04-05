import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    tenantId: string,
    tenantSlug: string,
    firstName: string,
    tenantName: string,
  ) {
    const [totalEmployees, activeEmployees, pendingLeaveRequests] =
      await Promise.all([
        this.prisma.employee.count({ where: { tenantId } }),
        this.prisma.employee.count({
          where: { tenantId, employmentStatus: 'ACTIVE' },
        }),
        this.prisma.leaveRequest.count({
          where: { tenantId, status: 'PENDING' },
        }),
      ]);

    return {
      adminFirstName: firstName,
      companyName: tenantName,
      totalEmployees,
      activeEmployees,
      pendingLeaveRequests,
      assignedAssetsCount: 0, // Assets module not yet implemented
      hasEmployees: totalEmployees > 0,
      modules: {
        hr: { enabled: true, locked: false },
        payroll: { enabled: true, locked: false },
        assets: { enabled: false, locked: true },
        recruitment: { enabled: false, locked: true },
      },
    };
  }

  async getEmployeeDashboard(tenantId: string, userId: string) {
    // Get employee profile
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
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
    const announcements = await this.prisma.announcement.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
      },
    });

    const isProfileIncomplete =
      employee && (!employee.jobTitle || !employee.departmentId);

    return {
      profile: {
        fullName: employee
          ? `${employee.firstName} ${employee.lastName}`
          : 'Name not set',
        jobTitle: employee?.jobTitle ?? 'No title assigned',
        department: employee?.department?.name ?? 'No department assigned',
        avatarUrl: employee?.avatarUrl ?? null,
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
        publishedAt: a.createdAt,
      })),
    };
  }
}
