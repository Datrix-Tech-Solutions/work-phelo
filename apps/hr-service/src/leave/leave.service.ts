import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.leaveType.create({ data: { tenantId, ...dto } });
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
  async initializeLeaveBalances(tenantId: string, employeeId: string) {
    const year = new Date().getFullYear();
    const leaveTypes = await this.prisma.leaveType.findMany({
      where: { tenantId, isActive: true },
    });

    for (const lt of leaveTypes) {
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
    return this.prisma.leaveBalance.findMany({
      where: { tenantId, employeeId, year },
      include: { leaveType: true },
    });
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
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (end < start)
      throw new BadRequestException('End date must be after start date');

    const totalDays =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const year = start.getFullYear();
    const balance = await this.prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId: dto.leaveTypeId,
          year,
        },
      },
    });

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

    return updated;
  }

  async cancelRequest(tenantId: string, requestId: string, employeeId: string) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, tenantId, employeeId },
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
