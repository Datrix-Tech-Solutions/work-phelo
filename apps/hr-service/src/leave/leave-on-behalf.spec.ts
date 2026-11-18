import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { LeaveService } from './leave.service';

describe('Leave recorded on behalf of an employee', () => {
  const tenantId = 'tenant-1';
  const approver = {
    id: 'user-hr',
    tenantId,
    tenantSlug: 'acme',
    role: 'EMPLOYEE',
    permissions: ['leave:APPROVE'],
  } as unknown as RequestUser;
  const dto = {
    employeeId: '06b5b149-8281-43c6-90f5-ac07dd1d8459',
    leaveTypeId: 'type-1',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
  };
  const employee = {
    id: dto.employeeId,
    userId: 'user-ama',
    firstName: 'Ama',
    lastName: 'Mensah',
    employmentType: 'FULL_TIME',
    employmentStatus: 'ACTIVE',
    gender: 'FEMALE',
    hireDate: new Date('2025-01-01'),
    managerId: null,
    departmentId: 'dept-1',
  };

  let service: LeaveService;
  let prisma: any;
  let tx: any;
  let notifyDecision: jest.SpyInstance;
  let notifyStakeholders: jest.SpyInstance;

  beforeEach(() => {
    tx = {
      leaveBalance: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      leaveRequest: {
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'request-1', ...data }),
          ),
      },
    };
    prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue(employee),
      },
      leaveType: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'type-1',
          name: 'Annual Leave',
          applicableTo: [],
          applicableGenders: [],
          requiresSupportingDocument: false,
        }),
      },
      leaveRequest: { findFirst: jest.fn().mockResolvedValue(null) },
      leaveBalance: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'balance-1', remainingDays: 21 }),
      },
      $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
    };
    service = new LeaveService(prisma, {} as never);
    const internals = service as any;
    internals.resolveEmployeeHolidayLocation = jest.fn().mockResolvedValue({});
    internals.ensurePublicHolidaysSeededForLocation = jest.fn();
    internals.calculateWorkingDayBreakdown = jest.fn().mockResolvedValue({
      totalDays: 5,
      yearlyBreakdown: new Map([[2026, 5]]),
    });
    internals.resolveLeaveNotificationRecipients = jest
      .fn()
      .mockResolvedValue({ manager: null, approvers: [] });
    notifyDecision = jest
      .spyOn(internals, 'notifyEmployeeOfLeaveDecision')
      .mockResolvedValue(undefined);
    notifyStakeholders = jest
      .spyOn(internals, 'notifyStakeholdersOfLeaveRequest')
      .mockResolvedValue(undefined);
  });

  it('saves the request as approved and moves the days straight to used', async () => {
    const result = await service.createRequestOnBehalf(tenantId, approver, dto);

    expect(tx.leaveBalance.updateMany).toHaveBeenCalledWith({
      where: { id: 'balance-1', remainingDays: { gte: 5 } },
      data: { usedDays: { increment: 5 }, remainingDays: { decrement: 5 } },
    });
    const data = tx.leaveRequest.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      employeeId: dto.employeeId,
      status: 'APPROVED',
      approvedBy: approver.id,
      requestedByUserId: approver.id,
    });
    expect(data.approvedAt).toBeInstanceOf(Date);
    expect(result.notificationSummary.autoApproved).toBe(true);
  });

  it('tells the employee, not the approvers', async () => {
    await service.createRequestOnBehalf(tenantId, approver, dto);

    expect(notifyDecision).toHaveBeenCalledTimes(1);
    expect(notifyDecision.mock.calls[0][5]).toBe('APPROVED');
    expect(notifyStakeholders).not.toHaveBeenCalled();
  });

  it('does not let anyone record leave for themselves', async () => {
    prisma.employee.findFirst.mockResolvedValue({
      ...employee,
      userId: approver.id,
    });

    await expect(
      service.createRequestOnBehalf(tenantId, approver, dto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('needs leave:APPROVE', async () => {
    const plain = { ...approver, permissions: [] } as unknown as RequestUser;

    await expect(
      service.createRequestOnBehalf(tenantId, plain, dto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.employee.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an employee from another tenant or one that does not exist', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(
      service.createRequestOnBehalf(tenantId, approver, dto),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: dto.employeeId, tenantId },
      }),
    );
  });

  it('still requires a supporting document when the leave type needs one', async () => {
    prisma.leaveType.findFirst.mockResolvedValue({
      id: 'type-1',
      name: 'Sick Leave',
      applicableTo: [],
      applicableGenders: [],
      requiresSupportingDocument: true,
    });

    await expect(
      service.createRequestOnBehalf(tenantId, approver, dto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('keeps the normal request pending with the days held as pending', async () => {
    prisma.employee.findFirst.mockResolvedValue(employee);

    await service.createRequest(tenantId, approver, dto);

    expect(tx.leaveBalance.updateMany.mock.calls[0][0].data).toEqual({
      pendingDays: { increment: 5 },
      remainingDays: { decrement: 5 },
    });
    const data = tx.leaveRequest.create.mock.calls[0][0].data;
    expect(data.status).toBe('PENDING');
    expect(data.approvedBy).toBeUndefined();
    expect(notifyStakeholders).toHaveBeenCalled();
  });
});
