import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';

const DEFAULT_LEAVE_TYPES = [
  {
    name: 'Annual Leave',
    daysAllowed: 21,
    isPaid: true,
    requiresApproval: true,
    isDefault: true,
  },
  {
    name: 'Sick Leave',
    daysAllowed: 14,
    isPaid: true,
    requiresApproval: false,
    isDefault: true,
  },
  {
    name: 'Maternity Leave',
    daysAllowed: 84,
    isPaid: true,
    requiresApproval: true,
    isDefault: true,
  },
  {
    name: 'Paternity Leave',
    daysAllowed: 5,
    isPaid: true,
    requiresApproval: true,
    isDefault: true,
  },
  {
    name: 'Compassionate Leave',
    daysAllowed: 3,
    isPaid: true,
    requiresApproval: true,
    isDefault: true,
  },
];

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RabbitMQPublisher))
    private readonly rabbitmq: RabbitMQPublisher,
  ) {}

  // ── Seed default leave types for new tenant ───────────────────────────────
  async seedDefaultLeaveTypes(tenantId: string) {
    for (const lt of DEFAULT_LEAVE_TYPES) {
      await this.prisma.leaveType.upsert({
        where: { tenantId_name: { tenantId, name: lt.name } },
        update: {},
        create: { tenantId, ...lt },
      });
    }
  }

  // ── Leave Types ───────────────────────────────────────────────────────────
  async createLeaveType(tenantId: string, dto: CreateLeaveTypeDto) {
    const existing = await this.prisma.leaveType.findFirst({
      where: { tenantId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('A leave type with this name already exists');
    }
    const leaveType = await this.prisma.leaveType.create({
      data: { tenantId, ...dto },
    });

    // Backfill leave balances for all existing active employees so they
    // immediately get an entitlement for this new leave type. Uses upsert
    // internally — safe to call on employees who already have balances.
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, employmentStatus: { not: 'OFFBOARDED' } },
      select: { id: true },
    });
    await Promise.all(
      employees.map((emp) => this.initializeLeaveBalances(tenantId, emp.id)),
    );

    return leaveType;
  }

  async updateLeaveType(
    tenantId: string,
    id: string,
    dto: Partial<CreateLeaveTypeDto>,
  ) {
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id, tenantId },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    // Check for existing requests
    const hasRequests = await this.prisma.leaveRequest.count({
      where: { leaveTypeId: id, tenantId },
    });

    const updated = await this.prisma.leaveType.update({
      where: { id },
      data: dto,
    });

    // When daysAllowed changes, update all existing balance records for the
    // current year so employees see the correct entitlement immediately.
    if (
      dto.daysAllowed !== undefined &&
      dto.daysAllowed !== leaveType.daysAllowed
    ) {
      const diff = dto.daysAllowed - leaveType.daysAllowed;
      const year = new Date().getFullYear();
      const balances = await this.prisma.leaveBalance.findMany({
        where: { leaveTypeId: id, year },
      });
      for (const balance of balances) {
        await this.prisma.leaveBalance.update({
          where: { id: balance.id },
          data: {
            totalDays: dto.daysAllowed,
            remainingDays: Math.max(0, balance.remainingDays + diff),
          },
        });
      }
    }

    return {
      ...updated,
      warning:
        hasRequests > 0
          ? 'Editing this leave type will not affect requests already submitted or approved.'
          : null,
    };
  }

  async deleteLeaveType(tenantId: string, id: string) {
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id, tenantId },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found');
    if (leaveType.isDefault) {
      throw new ForbiddenException('Default leave types cannot be deleted');
    }

    await this.prisma.leaveType.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Leave type deleted successfully' };
  }

  // ── Public Holidays ───────────────────────────────────────────────────────
  async createPublicHoliday(
    tenantId: string,
    dto: { name: string; date: string },
  ) {
    return this.prisma.publicHoliday.create({
      data: { tenantId, name: dto.name, date: new Date(dto.date) },
    });
  }

  async getPublicHolidays(tenantId: string) {
    return this.prisma.publicHoliday.findMany({
      where: { tenantId },
      orderBy: { date: 'asc' },
    });
  }

  async updatePublicHoliday(
    tenantId: string,
    id: string,
    dto: { name?: string; date?: string },
  ) {
    const holiday = await this.prisma.publicHoliday.findFirst({
      where: { id, tenantId },
    });
    if (!holiday) throw new NotFoundException('Public holiday not found');
    return this.prisma.publicHoliday.update({
      where: { id },
      data: { name: dto.name, date: dto.date ? new Date(dto.date) : undefined },
    });
  }

  async deletePublicHoliday(tenantId: string, id: string) {
    const holiday = await this.prisma.publicHoliday.findFirst({
      where: { id, tenantId },
    });
    if (!holiday) throw new NotFoundException('Public holiday not found');
    await this.prisma.publicHoliday.delete({ where: { id } });
    return { message: 'Public holiday deleted successfully' };
  }

  private async countWorkingDays(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const holidays = await this.prisma.publicHoliday.findMany({
      where: {
        tenantId,
        date: { gte: startDate, lte: endDate },
      },
    });
    const holidayDates = new Set(
      holidays.map((h) => h.date.toISOString().split('T')[0]),
    );
    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().split('T')[0];
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  async getPendingCount(tenantId: string, employeeId?: string) {
    const where: any = { tenantId, status: 'PENDING' };
    if (employeeId) where.employeeId = employeeId;
    const count = await this.prisma.leaveRequest.count({ where });
    return { count };
  }
  async getLeaveTypes(tenantId: string) {
    return this.prisma.leaveType.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // ── Leave Balances ────────────────────────────────────────────────────────
  async initializeLeaveBalances(
    tenantId: string,
    employeeId: string,
    year = new Date().getFullYear(),
  ) {
    let leaveTypes = await this.prisma.leaveType.findMany({
      where: { tenantId, isActive: true },
    });

    // If the tenant has no leave types yet (tenant pre-dates the approval event,
    // or the event was missed), seed defaults now so the employee always gets
    // balances regardless of event delivery.
    if (leaveTypes.length === 0) {
      await this.seedDefaultLeaveTypes(tenantId);
      leaveTypes = await this.prisma.leaveType.findMany({
        where: { tenantId, isActive: true },
      });
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { employmentType: true },
    });

    for (const lt of leaveTypes) {
      // Skip leave types that don't apply to this employee's employment type
      if (
        employee &&
        lt.applicableTo.length > 0 &&
        !lt.applicableTo.includes(employee.employmentType)
      ) {
        continue;
      }

      await this.prisma.leaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: { employeeId, leaveTypeId: lt.id, year },
        },
        update: {},
        create: {
          tenantId,
          employeeId,
          leaveTypeId: lt.id,
          year,
          totalDays: lt.daysAllowed,
          usedDays: 0,
          pendingDays: 0,
          remainingDays: lt.daysAllowed,
        },
      });
    }
  }

  async getLeaveBalances(tenantId: string, employeeId: string) {
    const year = new Date().getFullYear();
    let balances = await this.prisma.leaveBalance.findMany({
      where: { tenantId, employeeId, year },
      include: { leaveType: true },
    });

    // Self-heal: if this employee has no balances for the current year
    // (e.g. first access after a year rollover, or created before the
    // balance-init flow existed), initialise them now and re-fetch.
    if (balances.length === 0) {
      await this.initializeLeaveBalances(tenantId, employeeId, year);
      balances = await this.prisma.leaveBalance.findMany({
        where: { tenantId, employeeId, year },
        include: { leaveType: true },
      });
    }

    return balances;
  }

  async getEmployeeByUserId(tenantId: string, userId: string) {
    return this.prisma.employee.findFirst({ where: { userId, tenantId } });
  }

  async getMyLeaveBalances(tenantId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (!employee) return [];
    return this.getLeaveBalances(tenantId, employee.id);
  }

  async backfillLeaveBalances(tenantId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId },
    });
    for (const emp of employees) {
      await this.initializeLeaveBalances(tenantId, emp.id);
    }
    return {
      message: `Leave balances backfilled for ${employees.length} employees`,
    };
  }

  // ── Leave Requests ────────────────────────────────────────────────────────
  async createRequest(
    tenantId: string,
    userId: string,
    dto: CreateLeaveRequestDto,
  ) {
    const empRecord = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (!empRecord) throw new NotFoundException('Employee profile not found');
    const employeeId = empRecord.id;

    // Check leave type eligibility based on employment type
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id: dto.leaveTypeId, tenantId, isActive: true },
    });
    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }
    if (
      leaveType.applicableTo.length > 0 &&
      !leaveType.applicableTo.includes(empRecord.employmentType)
    ) {
      throw new ForbiddenException(
        `This leave type is not available for your employment type (${empRecord.employmentType.replace('_', ' ').toLowerCase()})`,
      );
    }
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (end < start)
      throw new BadRequestException('End date must be after start date');

    const totalDays = await this.countWorkingDays(tenantId, start, end);

    const year = start.getFullYear();
    let balance = await this.prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId: dto.leaveTypeId,
          year,
        },
      },
    });

    if (!balance) {
      // Self-heal: first access after a year rollover or a missed init event.
      // Initialise balances for this year and try once more.
      await this.initializeLeaveBalances(tenantId, employeeId, year);
      balance = await this.prisma.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId,
            leaveTypeId: dto.leaveTypeId,
            year,
          },
        },
      });
    }

    if (!balance)
      throw new BadRequestException(
        'No leave balance found for this leave type',
      );
    if (balance.remainingDays < totalDays) {
      throw new BadRequestException(
        `Insufficient leave balance. Available: ${balance.remainingDays} days, Requested: ${totalDays} days`,
      );
    }

    const request = await this.prisma.leaveRequest.create({
      data: {
        tenantId,
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate: start,
        endDate: end,
        totalDays,
        reason: dto.reason,
        status: 'PENDING',
      },
      include: {
        leaveType: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    });

    // Reserve days as pending
    await this.prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        pendingDays: { increment: totalDays },
        remainingDays: { decrement: totalDays },
      },
    });

    // Notify the employee's manager (fire-and-forget)
    void this.notifyManagerOfLeaveRequest(
      tenantId,
      empRecord,
      leaveType.name,
      dto.startDate,
      dto.endDate,
      totalDays,
      dto.reason,
    );

    return request;
  }

  async getRequests(
    tenantId: string,
    filters: {
      employeeId?: string;
      status?: string;
      managerId?: string;
    },
  ) {
    const where: any = { tenantId };
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status) where.status = filters.status;

    // If managerId — only show requests from employees in manager's department
    if (filters.managerId) {
      const managerEmployee = await this.prisma.employee.findFirst({
        where: { userId: filters.managerId, tenantId },
        include: { department: true },
      });
      if (managerEmployee?.departmentId) {
        where.employee = { departmentId: managerEmployee.departmentId };
      }
    }

    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        leaveType: { select: { name: true, isPaid: true } },
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewRequest(
    tenantId: string,
    requestId: string,
    reviewerId: string,
    dto: ReviewLeaveRequestDto,
  ) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, tenantId },
    });

    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('This request has already been reviewed');
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: dto.action,
        ...(dto.action === 'APPROVED'
          ? { approvedBy: reviewerId, approvedAt: new Date() }
          : {
              rejectedBy: reviewerId,
              rejectedAt: new Date(),
              rejectionNote: dto.note,
            }),
      },
    });

    // Update balance
    const year = request.startDate.getFullYear();
    const balance = await this.prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          year,
        },
      },
    });

    if (balance) {
      if (dto.action === 'APPROVED') {
        await this.prisma.leaveBalance.update({
          where: { id: balance.id },
          data: {
            usedDays: { increment: request.totalDays },
            pendingDays: { decrement: request.totalDays },
          },
        });
      } else {
        // Rejected — restore days
        await this.prisma.leaveBalance.update({
          where: { id: balance.id },
          data: {
            pendingDays: { decrement: request.totalDays },
            remainingDays: { increment: request.totalDays },
          },
        });
      }
    }

    // Notify the employee of the decision (fire-and-forget)
    void this.notifyEmployeeOfLeaveDecision(
      tenantId,
      request.employeeId,
      request.leaveTypeId,
      dto.action,
      request.startDate,
      request.endDate,
      request.totalDays,
      dto.note,
    );

    return updated;
  }

  // ── Private notification helpers ─────────────────────────────────────────

  private async notifyManagerOfLeaveRequest(
    tenantId: string,
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      managerId: string | null;
      departmentId: string | null;
    },
    leaveTypeName: string,
    startDate: string,
    endDate: string,
    totalDays: number,
    reason?: string,
  ) {
    try {
      let managerEmail: string | null = null;

      // Prefer the employee's direct manager
      if (employee.managerId) {
        const manager = await this.prisma.employee.findUnique({
          where: { id: employee.managerId },
          select: { email: true },
        });
        managerEmail = manager?.email ?? null;
      }

      // Fall back to the department manager
      if (!managerEmail && employee.departmentId) {
        const dept = await this.prisma.department.findUnique({
          where: { id: employee.departmentId },
          select: { managerId: true },
        });
        if (dept?.managerId) {
          const deptManager = await this.prisma.employee.findUnique({
            where: { id: dept.managerId },
            select: { email: true },
          });
          managerEmail = deptManager?.email ?? null;
        }
      }

      if (!managerEmail) {
        this.logger.warn(
          `No manager found for employee ${employee.id} — leave request notification skipped`,
        );
        return;
      }

      await this.rabbitmq.notificationLeaveRequested({
        tenantId,
        employeeId: employee.id,
        employeeFirstName: employee.firstName,
        employeeLastName: employee.lastName,
        managerEmail,
        leaveTypeName,
        startDate,
        endDate,
        totalDays,
        reason,
      });
    } catch (err) {
      this.logger.error(
        `Failed to emit leave requested notification for employee ${employee.id}`,
        err,
      );
    }
  }

  private async notifyEmployeeOfLeaveDecision(
    tenantId: string,
    employeeId: string,
    leaveTypeId: string,
    status: 'APPROVED' | 'REJECTED',
    startDate: Date,
    endDate: Date,
    totalDays: number,
    note?: string,
  ) {
    try {
      const [employee, leaveType] = await Promise.all([
        this.prisma.employee.findUnique({
          where: { id: employeeId },
          select: { email: true, firstName: true },
        }),
        this.prisma.leaveType.findUnique({
          where: { id: leaveTypeId },
          select: { name: true },
        }),
      ]);

      if (!employee) {
        this.logger.warn(
          `Employee ${employeeId} not found — leave reviewed notification skipped`,
        );
        return;
      }

      await this.rabbitmq.notificationLeaveReviewed({
        tenantId,
        employeeId,
        employeeEmail: employee.email,
        employeeFirstName: employee.firstName,
        status,
        leaveTypeName: leaveType?.name ?? 'Leave',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalDays,
        note,
      });
    } catch (err) {
      this.logger.error(
        `Failed to emit leave reviewed notification for employee ${employeeId}`,
        err,
      );
    }
  }

  async cancelRequest(tenantId: string, requestId: string, userId: string) {
    const empRecord = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (!empRecord) throw new NotFoundException('Employee profile not found');

    const request = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, tenantId, employeeId: empRecord.id },
    });

    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' },
    });

    // Restore balance
    const year = request.startDate.getFullYear();
    await this.prisma.leaveBalance.updateMany({
      where: {
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        year,
      },
      data: {
        pendingDays: { decrement: request.totalDays },
        remainingDays: { increment: request.totalDays },
      },
    });

    return { message: 'Leave request cancelled' };
  }
}
