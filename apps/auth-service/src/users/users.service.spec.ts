import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { AuditService } from '../audit/audit.service';
import { TenantAssetStorageService } from '../tenants/tenant-asset-storage.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

type MockFn = jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;

function makePrisma() {
  const prisma: {
    $transaction: jest.MockedFunction<
      (callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>
    >;
    resource: { upsert: MockFn };
    user: {
      findFirst: MockFn;
      findUnique: MockFn;
      create: MockFn;
      update: MockFn;
      updateMany: MockFn;
      findUniqueOrThrow: MockFn;
      delete: MockFn;
    };
    tenant: { findUnique: MockFn; update: MockFn };
    permissionSet: { findFirst: MockFn; findMany: MockFn };
    userPermissionSet: {
      createMany: MockFn;
      deleteMany: MockFn;
      upsert: MockFn;
    };
    refreshToken: { create: MockFn };
    employeeAccessCommand: { findFirst: MockFn };
    employeeAccessLifecycleCommand: { findFirst: MockFn };
  } = {
    $transaction: jest.fn(async (callback) => callback(prisma)),
    resource: {
      upsert: jest.fn() as MockFn,
    },
    user: {
      findFirst: jest.fn() as MockFn,
      findUnique: jest.fn() as MockFn,
      create: jest.fn() as MockFn,
      update: jest.fn().mockResolvedValue({}) as MockFn,
      updateMany: jest.fn().mockResolvedValue({ count: 1 }) as MockFn,
      findUniqueOrThrow: jest.fn() as MockFn,
      delete: jest.fn().mockResolvedValue({}) as MockFn,
    },
    tenant: {
      findUnique: jest.fn() as MockFn,
      update: jest.fn().mockResolvedValue({}) as MockFn,
    },
    permissionSet: {
      findFirst: jest.fn() as MockFn,
      findMany: jest.fn().mockResolvedValue([]) as MockFn,
    },
    userPermissionSet: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }) as MockFn,
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }) as MockFn,
      upsert: jest.fn().mockResolvedValue({}) as MockFn,
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({}) as MockFn,
    },
    employeeAccessCommand: {
      findFirst: jest.fn().mockResolvedValue(null) as MockFn,
    },
    employeeAccessLifecycleCommand: {
      findFirst: jest.fn().mockResolvedValue(null) as MockFn,
    },
  };
  return prisma;
}

function makeRabbit() {
  return {
    notificationInviteUser: jest.fn().mockResolvedValue(undefined) as MockFn,
    hrProvisionTenantWorkspace: jest
      .fn()
      .mockResolvedValue(undefined) as MockFn,
    hrLinkEmployeeIdentity: jest.fn().mockResolvedValue(undefined) as MockFn,
    verifyEmployeeAccessLink: jest
      .fn()
      .mockResolvedValue({ linked: true }) as MockFn,
  };
}

function makeAudit() {
  return {
    log: jest.fn().mockResolvedValue(undefined) as MockFn,
  };
}

function makeStorage() {
  return {
    storeUserAvatar: jest.fn() as MockFn,
    createSignedReadUrl: jest.fn() as MockFn,
    delete: jest.fn().mockResolvedValue(undefined) as MockFn,
    isUserAvatarObjectKey: jest.fn().mockReturnValue(false),
  };
}

function makeService(
  prisma = makePrisma(),
  rabbit = makeRabbit(),
  audit = makeAudit(),
  jwtService = {
    sign: jest
      .fn()
      .mockReturnValueOnce('access-token')
      .mockReturnValueOnce('refresh-token'),
  },
  storage = makeStorage(),
) {
  return new UsersService(
    prisma as unknown as PrismaService,
    rabbit as unknown as RabbitMQPublisher,
    jwtService as never,
    audit as unknown as AuditService,
    storage as unknown as TenantAssetStorageService,
  );
}

describe('UsersService sensitive update fencing', () => {
  it.each([1, 0])(
    'uses a lifecycle compare-and-set (matched rows: %i)',
    async (count) => {
      const prisma = makePrisma();
      const current = {
        id: 'user',
        tenantId: 'tenant',
        role: 'EMPLOYEE',
        status: 'ACTIVE',
        sessionVersion: 3,
        accessSuspendedAt: null,
      };
      prisma.user.findFirst.mockResolvedValue(current);
      prisma.user.updateMany.mockResolvedValue({ count });
      prisma.user.findUniqueOrThrow.mockResolvedValue(current);
      const service = makeService(prisma);
      const result = service.update(
        'tenant',
        'user',
        { status: 'ACTIVE' } as never,
        {
          id: 'admin',
          tenantId: 'tenant',
          role: 'TENANT_ADMIN',
          permissions: [],
        } as never,
      );
      if (count) await expect(result).resolves.toEqual(current);
      else await expect(result).rejects.toThrow(ConflictException);
      expect(prisma.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'user',
            tenantId: 'tenant',
            role: 'EMPLOYEE',
            status: 'ACTIVE',
            sessionVersion: 3,
            accessSuspendedAt: null,
          },
        }),
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
      if (!count) expect(prisma.user.findUniqueOrThrow).not.toHaveBeenCalled();
    },
  );
});

describe('UsersService.resendInvite', () => {
  const pendingUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'ama@acmeghana.com',
    firstName: 'Ama',
    lastName: 'Mensah',
    role: 'EMPLOYEE',
    status: 'PENDING_VERIFICATION',
    inviteToken: 'old-token',
    inviteExpiresAt: new Date('2026-06-01T00:00:00.000Z'),
    tenant: {
      id: 'tenant-1',
      slug: 'acme-ghana',
      name: 'Acme Ghana',
    },
  };

  it('regenerates pending invite token, emits resend metadata, audits, and does not return token', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue(pendingUser);
    const rabbit = makeRabbit();
    const audit = makeAudit();
    const service = makeService(prisma, rabbit, audit);

    const result = await service.resendInvite('tenant-1', 'user-1');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-1', tenantId: 'tenant-1' },
      include: { tenant: true },
    });
    const updateArgs = prisma.user.update.mock.calls[0][0] as {
      where: { id: string };
      data: { inviteToken: string; inviteExpiresAt: Date };
    };
    expect(updateArgs.where).toEqual({ id: 'user-1' });
    expect(updateArgs.data.inviteToken).toEqual(expect.any(String));
    expect(updateArgs.data.inviteToken).not.toBe(pendingUser.inviteToken);
    expect(updateArgs.data.inviteExpiresAt).toBeInstanceOf(Date);

    expect(rabbit.notificationInviteUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: pendingUser.id,
        tenantId: 'tenant-1',
        email: pendingUser.email,
        firstName: pendingUser.firstName,
        inviteToken: updateArgs.data.inviteToken,
        tenantName: pendingUser.tenant.name,
        acceptInviteUrl: expect.stringContaining(
          '/acme-ghana/accept-invite?token=',
        ),
        inviteKind: 'EMPLOYEE',
        isResend: true,
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: pendingUser.id,
        action: 'UPDATE',
        resource: 'users',
        resourceId: pendingUser.id,
        changes: expect.objectContaining({
          after: expect.objectContaining({ resendInvite: true }),
        }),
        status: 'SUCCESS',
      }),
    );
    expect(result).toEqual({ message: 'Invitation resent successfully' });
    expect(result).not.toHaveProperty('inviteToken');
  });

  it('rejects non-pending users', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue({
      ...pendingUser,
      status: 'ACTIVE',
      inviteToken: null,
    });
    const rabbit = makeRabbit();
    const service = makeService(prisma, rabbit);

    await expect(service.resendInvite('tenant-1', 'user-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(rabbit.notificationInviteUser).not.toHaveBeenCalled();
  });

  it('rejects wrong-tenant or missing users', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue(null);
    const service = makeService(prisma);

    await expect(service.resendInvite('tenant-2', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('UsersService.provisionEmployeeInvite', () => {
  const originalSuperAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const tenant = {
    id: 'tenant-1',
    slug: 'acme-ghana',
    name: 'Acme Ghana',
  };
  const pendingUser = {
    id: 'user-1',
    tenantId: tenant.id,
    email: 'kwame@acmeghana.com',
    firstName: 'Kwame',
    lastName: 'Mensah',
    phone: '+233200000000',
    role: 'EMPLOYEE',
    status: 'PENDING_VERIFICATION',
    forcePasswordReset: true,
    inviteToken: 'invite-token',
    inviteExpiresAt: new Date('2026-06-01T00:00:00.000Z'),
  };
  const inviteDto = {
    email: pendingUser.email,
    firstName: pendingUser.firstName,
    lastName: pendingUser.lastName,
    phone: pendingUser.phone,
  };

  beforeEach(() => {
    process.env.SUPER_ADMIN_EMAIL = 'owner@workphelo.com';
  });

  afterAll(() => {
    process.env.SUPER_ADMIN_EMAIL = originalSuperAdminEmail;
  });

  function arrangeProvisioning() {
    const prisma = makePrisma();
    prisma.permissionSet.findFirst.mockResolvedValue({ id: 'employee-set' });
    prisma.tenant.findUnique.mockResolvedValue(tenant);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.permissionSet.findMany.mockResolvedValue([
      { id: 'employee-set', name: 'Employee' },
    ]);
    prisma.user.create.mockResolvedValue(pendingUser);
    const rabbit = makeRabbit();
    const audit = makeAudit();
    const service = makeService(prisma, rabbit, audit);

    return { prisma, rabbit, audit, service };
  }

  it('assigns the baseline Employee permission set without reseeding global resources', async () => {
    const { prisma, service } = arrangeProvisioning();

    const result = await service.provisionEmployeeInvite(tenant.id, inviteDto);

    expect(result).toEqual({
      userId: pendingUser.id,
      email: pendingUser.email,
      inviteSent: true,
    });
    expect(prisma.resource.upsert).not.toHaveBeenCalled();
    expect(prisma.userPermissionSet.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: pendingUser.id,
          permissionSetId: 'employee-set',
          grantedBy: pendingUser.id,
        },
      ],
      skipDuplicates: true,
    });
  });

  it('creates the user and assigns baseline permissions in one transaction to avoid cleanup races', async () => {
    const { prisma, service } = arrangeProvisioning();
    let insideTransaction = false;
    prisma.$transaction.mockImplementationOnce(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        insideTransaction = true;
        try {
          return await callback(prisma);
        } finally {
          insideTransaction = false;
        }
      },
    );
    prisma.user.create.mockImplementationOnce(async () => {
      expect(insideTransaction).toBe(true);
      return pendingUser;
    });
    prisma.userPermissionSet.createMany.mockImplementationOnce(async () => {
      expect(insideTransaction).toBe(true);
      return { count: 1 };
    });

    await service.provisionEmployeeInvite(tenant.id, inviteDto);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does not fail successful provisioning when invite notification publishing fails', async () => {
    const { prisma, rabbit, service } = arrangeProvisioning();
    rabbit.notificationInviteUser.mockRejectedValueOnce(
      new Error('notification unavailable'),
    );

    await expect(
      service.provisionEmployeeInvite(tenant.id, inviteDto),
    ).resolves.toEqual({
      userId: pendingUser.id,
      email: pendingUser.email,
      inviteSent: true,
    });

    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.userPermissionSet.createMany).toHaveBeenCalled();
  });

  it('keeps the mocked DB provisioning path well below the HR RPC timeout', async () => {
    const { service } = arrangeProvisioning();
    const startedAt = Date.now();

    await service.provisionEmployeeInvite(tenant.id, inviteDto);

    expect(Date.now() - startedAt).toBeLessThan(2000);
  });
});

describe('UsersService.deletePendingEmployeeInvite', () => {
  it('is idempotent when the pending invite no longer exists', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const service = makeService(prisma);

    await expect(
      service.deletePendingEmployeeInvite('tenant-1', {
        email: 'missing@acmeghana.com',
      }),
    ).resolves.toEqual({ deleted: false });
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('deletes only rollback-eligible pending employee invites', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'EMPLOYEE',
      status: 'PENDING_VERIFICATION',
      inviteToken: 'token',
    });
    const service = makeService(prisma);

    await expect(
      service.deletePendingEmployeeInvite('tenant-1', {
        email: 'pending@acmeghana.com',
      }),
    ).resolves.toEqual({ deleted: true });
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });

  it('rejects rollback once an invite is no longer pending', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      inviteToken: null,
    });
    const service = makeService(prisma);

    await expect(
      service.deletePendingEmployeeInvite('tenant-1', {
        email: 'active@acmeghana.com',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
});

describe('UsersService.acceptInvite after resend token rotation', () => {
  const tenant = {
    id: 'tenant-1',
    slug: 'acme-ghana',
    name: 'Acme Ghana',
    email: 'admin@acmeghana.com',
    country: 'GH',
    currency: 'GHS',
  };

  const pendingAdmin = {
    id: 'admin-1',
    tenantId: tenant.id,
    email: 'admin@acmeghana.com',
    firstName: 'Ama',
    lastName: 'Admin',
    role: 'TENANT_ADMIN',
    status: 'PENDING_VERIFICATION',
    inviteToken: 'new-token',
    inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    tenant,
  };

  it('rejects the old expired token after resend and activates with the new token', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(pendingAdmin)
      .mockResolvedValueOnce(null);
    prisma.user.update.mockResolvedValue({
      ...pendingAdmin,
      status: 'ACTIVE',
      inviteToken: null,
      inviteExpiresAt: null,
    });

    const rabbit = makeRabbit();
    const service = makeService(prisma, rabbit);

    await expect(
      service.acceptInvite({
        inviteToken: 'old-expired-token',
        password: 'Password123!',
      }),
    ).rejects.toThrow(ForbiddenException);

    const result = await service.acceptInvite({
      inviteToken: 'new-token',
      password: 'Password123!',
    });

    expect(prisma.user.findUnique).toHaveBeenNthCalledWith(1, {
      where: { inviteToken: 'old-expired-token' },
      include: { tenant: true },
    });
    expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, {
      where: { inviteToken: 'new-token' },
      include: { tenant: true },
    });
    expect(rabbit.hrProvisionTenantWorkspace).toHaveBeenCalledWith({
      tenantId: tenant.id,
      adminEmail: tenant.email,
      adminUserId: pendingAdmin.id,
      country: tenant.country,
      currency: tenant.currency,
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: pendingAdmin.id },
        data: expect.objectContaining({
          status: 'ACTIVE',
          emailVerifiedAt: expect.any(Date),
          inviteToken: null,
          inviteExpiresAt: null,
        }),
      }),
    );
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: tenant.id },
      data: { status: 'ACTIVE' },
    });
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    await expect(
      service.acceptInvite({
        inviteToken: 'new-token',
        password: 'Password123!',
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('managed employee invitation activation', () => {
  it('does not allow legacy rollback to delete a durably renewed legacy invitation', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue({ id: 'legacy-user' });
    prisma.employeeAccessLifecycleCommand.findFirst.mockResolvedValue({
      id: 'renewal',
    });
    await expect(
      makeService(prisma).deletePendingEmployeeInvite('tenant', {
        userId: 'legacy-user',
        email: 'legacy@example.test',
      }),
    ).resolves.toEqual({ deleted: false });
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
  function setup() {
    const prisma = makePrisma();
    const rabbit = makeRabbit();
    const user = {
      id: 'employee-user',
      tenantId: 'tenant-1',
      role: 'EMPLOYEE',
      status: 'PENDING_VERIFICATION',
      email: 'employee@example.test',
      firstName: 'Employee',
      lastName: 'Test',
      inviteToken: 'invite-token',
      inviteExpiresAt: new Date(Date.now() + 3600000),
      tenant: { id: 'tenant-1', slug: 'tenant', name: 'Tenant' },
    };
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      ...user,
      status: 'ACTIVE',
    });
    prisma.employeeAccessCommand.findFirst.mockResolvedValue({
      id: 'operation',
      employeeId: 'employee',
      actorUserId: 'actor',
      requestHash: 'hash',
      status: 'PROVIDER_ACCEPTED',
    });
    return { prisma, rabbit, service: makeService(prisma, rabbit) };
  }

  it('activates only after confirmed linkage using an atomic pending/token check', async () => {
    const { prisma, rabbit, service } = setup();
    await service.acceptInvite({
      inviteToken: 'invite-token',
      password: 'Password123!',
    });
    expect(rabbit.verifyEmployeeAccessLink).toHaveBeenCalledWith({
      operationId: 'operation',
      tenantId: 'tenant-1',
      employeeId: 'employee',
      actorUserId: 'actor',
      requestHash: 'hash',
      userId: 'employee-user',
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'employee-user',
          tenantId: 'tenant-1',
          status: 'PENDING_VERIFICATION',
          inviteToken: 'invite-token',
        },
      }),
    );
    expect(rabbit.hrLinkEmployeeIdentity).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects a missing or ineligible HR linkage without activating', async () => {
    const { prisma, rabbit, service } = setup();
    rabbit.verifyEmployeeAccessLink.mockResolvedValue({ linked: false });
    await expect(
      service.acceptInvite({
        inviteToken: 'invite-token',
        password: 'Password123!',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('uses the same atomic activation protection for renewed pre-Phase-2 invitations', async () => {
    const { prisma, service, rabbit } = setup();
    prisma.employeeAccessCommand.findFirst.mockResolvedValue(null);
    prisma.employeeAccessLifecycleCommand.findFirst.mockResolvedValue({
      id: 'resend-operation',
      employeeId: 'employee',
      actorUserId: 'actor',
      requestHash: 'hash',
      status: 'COMPLETED',
    });
    await service.acceptInvite({
      inviteToken: 'invite-token',
      password: 'Password123!',
    });
    expect(prisma.user.updateMany).toHaveBeenCalled();
    expect(rabbit.hrLinkEmployeeIdentity).not.toHaveBeenCalled();
  });

  it('does not reactivate a user offboarded while acceptance was in flight', async () => {
    const { prisma, service } = setup();
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.acceptInvite({
        inviteToken: 'invite-token',
        password: 'Password123!',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    expect(prisma.user.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
