import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TenantLifecycleService } from './tenant-lifecycle.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import * as permissionSets from '../permissions/system-permission-sets';
import { RESOURCES } from '../permissions/resource-definitions';

jest.mock('../permissions/system-permission-sets', () => ({
  ensurePermissionResources: jest.fn().mockResolvedValue({}),
  seedDefaultPermissionTemplates: jest
    .fn()
    .mockResolvedValue({ Employee: 'set-1' }),
}));

const dto: CreateTenantDto = {
  name: 'Acme Ghana',
  slug: 'acme-ghana',
  email: 'admin@acme.test',
  firstName: 'Ama',
  lastName: 'Mensah',
};

function setup() {
  const tenant = {
    id: 'tenant-1',
    name: dto.name,
    slug: dto.slug,
    email: dto.email,
    status: 'PENDING',
  };
  const user = {
    id: 'user-1',
    email: dto.email,
    firstName: dto.firstName,
    status: 'PENDING_VERIFICATION',
    role: 'TENANT_ADMIN',
  };
  const tx = {
    tenant: { create: jest.fn().mockResolvedValue(tenant) },
    user: { create: jest.fn().mockResolvedValue(user) },
  };
  const prisma = {
    resource: { findMany: jest.fn().mockResolvedValue([]) },
    tenant: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(tenant),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(tx)),
  };
  const rabbitmq = {
    notificationInviteUser: jest.fn().mockResolvedValue(undefined),
    hrProvisionTenantWorkspace: jest.fn(),
    hrRecruitmentEmployerUpdated: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new TenantLifecycleService(
    prisma as never,
    rabbitmq as never,
    audit as never,
  );
  return { service, prisma, rabbitmq, audit, tx };
}

describe('TenantLifecycleService public registration', () => {
  beforeEach(() => {
    process.env.SUPER_ADMIN_EMAIL = 'platform@workphelo.test';
    process.env.PUBLIC_TENANT_REGISTRATION = 'true';
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.PUBLIC_TENANT_REGISTRATION;
  });

  it('refuses public registration unless it is switched on, but still lets the platform register companies', async () => {
    const { service, prisma, tx } = setup();
    delete process.env.PUBLIC_TENANT_REGISTRATION;

    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();

    await service.register(dto, true);
    expect(tx.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isVerified: true }),
      }),
    );
  });

  it('marks a company verified on approval but leaves a website recruiter unverified', async () => {
    const { service, prisma } = setup();
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    prisma.tenant.update.mockResolvedValue({ id: 'tenant-1' });

    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      selfRegistered: false,
      source: 'PLATFORM',
    });
    await service.approveTenant('tenant-1');
    expect(prisma.tenant.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { status: 'ACTIVE', isVerified: true },
      }),
    );

    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-2',
      selfRegistered: false,
      source: 'WEBSITE',
    });
    await service.approveTenant('tenant-2');
    expect(prisma.tenant.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { status: 'ACTIVE' } }),
    );
  });

  it('tells HR to hide a suspended company and to show the check mark once verified', async () => {
    const { service, prisma, rabbitmq } = setup();
    prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    (prisma.user as any).findMany = jest.fn().mockResolvedValue([]);
    (prisma as any).refreshToken = { updateMany: jest.fn() };

    prisma.tenant.update.mockResolvedValue({
      id: 'tenant-1',
      status: 'SUSPENDED',
      isVerified: false,
    });
    await service.suspendTenant('tenant-1');
    expect(rabbitmq.hrRecruitmentEmployerUpdated).toHaveBeenLastCalledWith({
      tenantId: 'tenant-1',
      isVerified: false,
      isBlocked: true,
    });

    prisma.tenant.update.mockResolvedValue({
      id: 'tenant-1',
      status: 'ACTIVE',
      isVerified: true,
    });
    await service.setVerified('tenant-1', true);
    expect(rabbitmq.hrRecruitmentEmployerUpdated).toHaveBeenLastCalledWith({
      tenantId: 'tenant-1',
      isVerified: true,
      isBlocked: false,
    });
  });

  it('does not fail the admin action when HR cannot be reached', async () => {
    const { service, prisma, rabbitmq } = setup();
    prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
    prisma.tenant.update.mockResolvedValue({
      id: 'tenant-1',
      status: 'ACTIVE',
      isVerified: true,
    });
    rabbitmq.hrRecruitmentEmployerUpdated.mockRejectedValue(new Error('down'));

    await expect(service.setVerified('tenant-1', true)).resolves.toBeDefined();
  });

  it('lets a super admin set and remove the verified check mark', async () => {
    const { service, prisma } = setup();
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      isVerified: false,
    });
    prisma.tenant.update.mockResolvedValue({
      id: 'tenant-1',
      isVerified: true,
    });

    await service.setVerified('tenant-1', true);

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { isVerified: true },
    });
  });

  it('commits pending tenant, templates, and admin before publishing invite', async () => {
    const { service, prisma, rabbitmq, tx } = setup();
    const response = await service.register({ ...dto, slug: 'ACME-GHANA' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'acme-ghana',
          status: 'PENDING',
          selfRegistered: true,
        }),
      }),
    );
    expect(permissionSets.seedDefaultPermissionTemplates).toHaveBeenCalledWith(
      tx,
      'tenant-1',
      expect.anything(),
      {},
    );
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'TENANT_ADMIN',
          status: 'PENDING_VERIFICATION',
          password: '',
        }),
      }),
    );
    expect(rabbitmq.notificationInviteUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: dto.email,
        inviteKind: 'TENANT_ADMIN',
        acceptInviteUrl: expect.stringContaining('/acme-ghana/accept-invite'),
      }),
    );
    expect(response).toEqual({
      status: 'PENDING_VERIFICATION',
      message: 'Registration received. Check your email to continue setup.',
    });
    expect(response).not.toHaveProperty('accessToken');
    expect(response).not.toHaveProperty('tenantId');
  });

  it('preserves the managed Super Admin registration response and marker', async () => {
    const { service, tx } = setup();
    const response = await service.register(dto, true);
    expect(tx.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ selfRegistered: false }),
      }),
    );
    expect(response).toHaveProperty('tenantId', 'tenant-1');
  });

  it('uses already-seeded resources without reseeding the global catalog', async () => {
    const { service, prisma } = setup();
    prisma.resource.findMany.mockResolvedValue(
      RESOURCES.map((resource) => ({ id: resource.name, name: resource.name })),
    );
    await service.register(dto);
    expect(permissionSets.ensurePermissionResources).not.toHaveBeenCalled();
  });

  it('rejects reserved slugs and duplicate details without revealing which field matched', async () => {
    const { service, prisma } = setup();
    await expect(
      service.register({ ...dto, slug: ' API ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.tenant.findFirst.mockResolvedValue({ email: dto.email });
    await expect(service.register(dto)).rejects.toThrow(
      'Company registration details are unavailable',
    );
  });

  it('translates a database uniqueness race into a stable conflict', async () => {
    const { service, prisma, rabbitmq } = setup();
    prisma.$transaction.mockRejectedValue({ code: 'P2002' });
    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(rabbitmq.notificationInviteUser).not.toHaveBeenCalled();
  });

  it('does not publish an invite or audit a failed bootstrap', async () => {
    const { service, prisma, rabbitmq, audit } = setup();
    prisma.$transaction.mockRejectedValue(
      new Error('template bootstrap failed'),
    );
    await expect(service.register(dto)).rejects.toThrow(
      'template bootstrap failed',
    );
    expect(rabbitmq.notificationInviteUser).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('keeps a committed registration pending if invite publication fails', async () => {
    const { service, rabbitmq, tx } = setup();
    rabbitmq.notificationInviteUser.mockRejectedValue(
      new Error('broker unavailable'),
    );
    await expect(service.register(dto)).resolves.toHaveProperty(
      'status',
      'PENDING_VERIFICATION',
    );
    expect(tx.tenant.create).toHaveBeenCalledTimes(1);
  });

  it('does not let approval fabricate email ownership for self-registration', async () => {
    const { service, prisma, rabbitmq } = setup();
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      selfRegistered: true,
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      status: 'PENDING_VERIFICATION',
      emailVerifiedAt: null,
    });
    await expect(service.approveTenant('tenant-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(rabbitmq.hrProvisionTenantWorkspace).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('does not activate a self-registered tenant with email verification alone', async () => {
    const { service, prisma, rabbitmq } = setup();
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      selfRegistered: true,
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      password: '',
      inviteToken: 'unaccepted-token',
    });
    await expect(service.approveTenant('tenant-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(rabbitmq.hrProvisionTenantWorkspace).not.toHaveBeenCalled();
  });

  it('never rewrites email verification for an already active self-registered admin', async () => {
    const { service, prisma, rabbitmq } = setup();
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      selfRegistered: true,
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      password: 'hashed-password',
      inviteToken: null,
    });
    prisma.tenant.update.mockResolvedValue({
      id: 'tenant-1',
      status: 'ACTIVE',
    });
    await service.approveTenant('tenant-1');
    expect(rabbitmq.hrProvisionTenantWorkspace).toHaveBeenCalledTimes(1);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('preserves the existing approval path for managed tenants', async () => {
    const { service, prisma, rabbitmq } = setup();
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      selfRegistered: false,
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      emailVerifiedAt: null,
    });
    prisma.tenant.update.mockResolvedValue({
      id: 'tenant-1',
      status: 'ACTIVE',
    });
    await service.approveTenant('tenant-1');
    expect(rabbitmq.hrProvisionTenantWorkspace).toHaveBeenCalledTimes(1);
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ACTIVE',
          emailVerifiedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('normalizes slug and rejects malformed email, separator, and trusted fields at DTO boundary', async () => {
    const normalized = plainToInstance(CreateTenantDto, {
      ...dto,
      slug: ' ACME-GHANA ',
    });
    expect(normalized.slug).toBe('acme-ghana');
    expect(await validate(normalized)).toEqual([]);
    for (const input of [
      { ...dto, email: 'not-an-email' },
      { ...dto, slug: '-acme-' },
    ]) {
      expect(
        (await validate(plainToInstance(CreateTenantDto, input))).length,
      ).toBeGreaterThan(0);
    }
    const withRole = plainToInstance(CreateTenantDto, {
      ...dto,
      role: 'SUPER_ADMIN',
    });
    expect(
      (
        await validate(withRole, {
          whitelist: true,
          forbidNonWhitelisted: true,
        })
      ).length,
    ).toBeGreaterThan(0);
  });
});
