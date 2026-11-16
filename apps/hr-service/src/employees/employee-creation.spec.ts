import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ValidationPipe,
} from '@nestjs/common';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeImportRowDto } from './dto/bulk-import-employees.dto';
import { EmployeesService } from './employees.service';
import { EmploymentType } from '../../prisma/generated/client';

describe('Employee creation without system access', () => {
  const dto = {
    firstName: 'Ama',
    lastName: 'Mensah',
    departmentId: '06b5b149-8281-43c6-90f5-ac07dd1d8459',
    jobTitle: 'Officer',
    employmentType: EmploymentType.FULL_TIME,
    hireDate: '2026-01-01',
  };
  let service: EmployeesService;
  let prisma: any;
  let rabbitmq: any;
  let leave: any;
  let encryption: any;

  beforeEach(() => {
    prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...data, id: 'employee-1' }),
          ),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      department: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue({ id: dto.departmentId }),
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: dto.departmentId, name: 'HR' }]),
      },
      branch: { findMany: jest.fn().mockResolvedValue([]) },
      tenantConfig: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    prisma.$transaction = jest.fn(async (fn) => fn(prisma));
    rabbitmq = {
      authProvisionEmployeeInvite: jest
        .fn()
        .mockRejectedValue(new Error('Auth unavailable')),
      authDeletePendingEmployeeInvite: jest.fn(),
      authResendEmployeeInvite: jest.fn(),
    };
    leave = {
      initializeLeaveBalances: jest.fn(),
      ensurePublicHolidaysSeededForEmployee: jest.fn(),
    };
    encryption = {
      encrypt: jest.fn((v) => v),
      hmac: jest.fn((v) => `hash:${v}`),
      decryptEmployeeFields: jest.fn((v) => v),
    };
    service = new EmployeesService(
      prisma,
      rabbitmq,
      leave,
      {} as never,
      encryption,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it.each([undefined, null, '', ' \t\n '])(
    'creates without email (%p) and never calls Auth',
    async (email) => {
      const result = await service.create('tenant-1', { ...dto, email });
      expect(result).toMatchObject({
        tenantId: 'tenant-1',
        userId: null,
        email: null,
        normalizedEmail: null,
        emailHash: null,
      });
      expect(encryption.hmac).not.toHaveBeenCalled();
      expect(rabbitmq.authProvisionEmployeeInvite).not.toHaveBeenCalled();
      expect(rabbitmq.authDeletePendingEmployeeInvite).not.toHaveBeenCalled();
      expect(leave.initializeLeaveBalances).toHaveBeenCalledWith(
        'tenant-1',
        'employee-1',
        undefined,
        prisma,
      );
    },
  );

  it('normalizes and hashes email without granting access despite Auth being unavailable', async () => {
    const result = await service.create('tenant-1', {
      ...dto,
      email: ' Ama@Example.com ',
      grantSystemAccess: false,
    });
    expect(result).toMatchObject({
      email: 'ama@example.com',
      normalizedEmail: 'ama@example.com',
      emailHash: 'hash:ama@example.com',
      userId: null,
    });
    expect(prisma.employee.update).not.toHaveBeenCalled();
    expect(rabbitmq.authProvisionEmployeeInvite).not.toHaveBeenCalled();
  });

  it('rejects malformed email before writes', async () => {
    await expect(
      service.create('tenant-1', { ...dto, email: 'not-an-email' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects access requests without trusted users:CREATE authority before any database or Auth operation', async () => {
    await expect(
      service.create('tenant-1', {
        ...dto,
        email: 'ama@example.com',
        grantSystemAccess: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.department.count).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(rabbitmq.authProvisionEmployeeInvite).not.toHaveBeenCalled();
  });

  it.each(['userId', 'tenantId'])(
    'rejects client-controlled %s even in internal create callers',
    async (field) => {
      await expect(
        service.create('tenant-1', { ...dto, [field]: 'spoofed' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('rejects an existing normalized tenant email without changing the linked account', async () => {
    prisma.employee.findFirst.mockResolvedValue({
      id: 'existing',
      userId: 'existing-user',
    });
    await expect(
      service.create('tenant-1', { ...dto, email: 'AMA@example.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.employee.update).not.toHaveBeenCalled();
  });

  it('maps a concurrent unique-email violation to 409 after both prechecks pass', async () => {
    prisma.employee.create
      .mockResolvedValueOnce({
        id: 'employee-1',
        hireDate: new Date(dto.hireDate),
      })
      .mockRejectedValueOnce({
        code: 'P2002',
        meta: { target: ['tenantId', 'normalizedEmail'] },
      });
    const results = await Promise.allSettled([
      service.create('tenant-1', { ...dto, email: 'ama@example.com' }),
      service.create('tenant-1', { ...dto, email: 'AMA@example.com' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find(
      (r) => r.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(ConflictException);
  });

  it('retries employee-number collisions using a fresh transaction', async () => {
    prisma.employee.create.mockRejectedValueOnce({
      code: 'P2002',
      meta: { target: ['tenantId', 'employeeNumber'] },
    });
    await service.create('tenant-1', dto);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('rejects onboarding transaction failure without compensating against Auth', async () => {
    leave.initializeLeaveBalances.mockRejectedValue(
      new Error('balance write failed'),
    );
    await expect(service.create('tenant-1', dto)).rejects.toThrow(
      'balance write failed',
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(leave.ensurePublicHolidaysSeededForEmployee).not.toHaveBeenCalled();
    expect(rabbitmq.authDeletePendingEmployeeInvite).not.toHaveBeenCalled();
  });

  it('does not report a committed employee as failed if recoverable holiday seeding fails', async () => {
    leave.ensurePublicHolidaysSeededForEmployee.mockRejectedValue(
      new Error('calendar unavailable'),
    );
    await expect(service.create('tenant-1', dto)).resolves.toMatchObject({
      id: 'employee-1',
    });
    expect(prisma.employee.delete).not.toHaveBeenCalled();
  });

  it('bulk imports an employee without email or account', async () => {
    const result = await service.bulkImport('tenant-1', [
      { ...dto, departmentName: 'HR' },
    ]);
    expect(result[0]).toMatchObject({ status: 'created' });
    expect(prisma.employee.create.mock.calls[0][0].data).toMatchObject({
      email: null,
      userId: null,
    });
    expect(rabbitmq.authProvisionEmployeeInvite).not.toHaveBeenCalled();
  });

  it('does not turn resend into an access grant for an unlinked employee', async () => {
    prisma.employee.findFirst.mockResolvedValue({
      id: 'employee-1',
      userId: null,
      email: 'ama@example.com',
    });
    await expect(
      service.resendInvite('tenant-1', 'employee-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(rabbitmq.authResendEmployeeInvite).not.toHaveBeenCalled();
  });

  it('requires explicit current authority even for a linked employee resend', async () => {
    prisma.employee.findFirst.mockResolvedValue({
      id: 'employee-1',
      userId: 'user-1',
      email: 'ama@example.com',
      firstName: 'Ama',
      lastName: 'Mensah',
    });
    await expect(
      service.resendInvite('tenant-1', 'employee-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(rabbitmq.authResendEmployeeInvite).not.toHaveBeenCalled();
  });

  it('validates the public DTO and rejects spoofed identity/permission fields', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const meta = { type: 'body' as const, metatype: CreateEmployeeDto };
    const result = await pipe.transform({ ...dto, email: '  ' }, meta);
    expect(result.email).toBeNull();
    expect(result.grantSystemAccess).toBe(false);
    for (const field of ['userId', 'tenantId', 'permissionSetIds', 'role']) {
      await expect(
        pipe.transform({ ...dto, [field]: 'spoofed' }, meta),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(
      pipe.transform({ ...dto, email: 'invalid' }, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      pipe.transform({ ...dto, grantSystemAccess: 'false' }, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
    const importDto = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      jobTitle: dto.jobTitle,
      employmentType: dto.employmentType,
      hireDate: dto.hireDate,
    };
    const imported = await pipe.transform(
      { ...importDto, departmentName: 'HR', email: null },
      { type: 'body', metatype: EmployeeImportRowDto },
    );
    expect(imported.email).toBeNull();
  });
});
