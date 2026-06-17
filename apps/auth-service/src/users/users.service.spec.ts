import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { AuditService } from '../audit/audit.service';

type MockFn = jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;

function makePrisma() {
  return {
    user: {
      findFirst: jest.fn() as MockFn,
      update: jest.fn().mockResolvedValue({}) as MockFn,
    },
  };
}

function makeRabbit() {
  return {
    notificationInviteUser: jest.fn().mockResolvedValue(undefined) as MockFn,
  };
}

function makeAudit() {
  return {
    log: jest.fn().mockResolvedValue(undefined) as MockFn,
  };
}

function makeService(
  prisma = makePrisma(),
  rabbit = makeRabbit(),
  audit = makeAudit(),
) {
  return new UsersService(
    prisma as unknown as PrismaService,
    rabbit as unknown as RabbitMQPublisher,
    {} as never,
    audit as unknown as AuditService,
  );
}

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
