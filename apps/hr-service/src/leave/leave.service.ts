import {
  Injectable,
  NotFoundException,
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
    return this.prisma.leaveType.create({ data: { tenantId, ...dto } });
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
