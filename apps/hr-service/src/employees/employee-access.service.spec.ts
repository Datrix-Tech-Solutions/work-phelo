import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { accessFingerprint } from '@work-phelo/internal-auth';
import { httpCorsOptions } from '../config/cors';
import {
  accessKey,
  assertAccessActor,
  EmployeeAccessService,
} from './employee-access.service';

describe('Employee system access boundaries', () => {
  it('allows browser clients to supply required stable idempotency keys', () => {
    expect(httpCorsOptions().allowedHeaders).toContain('Idempotency-Key');
    expect(httpCorsOptions().allowedHeaders).not.toContain('*');
  });
  const actor: RequestUser = {
    id: 'actor',
    tenantId: 'tenant',
    email: 'actor@example.test',
    firstName: 'Actor',
    role: 'EMPLOYEE',
    tenantSlug: 'tenant',
    tenantName: 'Tenant',
    moduleConfig: { hr: true },
    featureConfig: {},
    permissions: [
      'employees:EDIT',
      'users:CREATE',
      'employees:VIEW',
      'users:VIEW',
    ],
  };

  it.each([
    'ACTIVE',
    'SUSPENDED',
    'INACTIVE',
    'INVITED',
    'INVITE_EXPIRED',
    'PROVISIONING',
  ])(
    'reads Auth-owned %s without inferring it from HR employment status',
    async (status) => {
      const prisma = {
        employee: {
          findFirst: jest.fn().mockResolvedValue({
            userId: 'linked-user',
            employmentStatus: 'ACTIVE',
          }),
        },
        employeeAccessOperation: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      const service = new EmployeeAccessService(
        prisma as never,
        {
          employeeAccessAccount: jest.fn().mockResolvedValue({ status }),
        } as never,
      );
      await expect(
        service.read('tenant', 'employee', actor),
      ).resolves.toMatchObject({ status, pendingAction: null });
    },
  );

  it('reports unavailable rather than absent or active when Auth cannot be reached', async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({ userId: 'linked-user' }),
      },
      employeeAccessOperation: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new EmployeeAccessService(
      prisma as never,
      {
        employeeAccessAccount: jest
          .fn()
          .mockRejectedValue(new Error('unavailable')),
      } as never,
    );
    await expect(
      service.read('tenant', 'employee', actor),
    ).resolves.toMatchObject({ status: 'UNAVAILABLE', accountStatus: null });
  });

  it('keeps NONE independent of Auth for an unlinked employee with no operation', async () => {
    const lookup = jest.fn();
    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue({ userId: null }) },
      employeeAccessOperation: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new EmployeeAccessService(
      prisma as never,
      { employeeAccessAccount: lookup } as never,
    );
    await expect(
      service.read('tenant', 'employee', actor),
    ).resolves.toMatchObject({ status: 'NONE' });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('does not equate employees:EDIT or users:EDIT with users:DELETE', async () => {
    const transaction = jest.fn();
    const service = new EmployeeAccessService(
      { $transaction: transaction } as never,
      {} as never,
    );
    await expect(
      service.lifecycle(
        'tenant',
        'employee',
        { ...actor, permissions: ['employees:EDIT', 'users:EDIT'] },
        'request-key',
        'SUSPEND',
        'Reason',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('requires both employee and user lifecycle authority', () => {
    expect(() =>
      assertAccessActor(actor, 'tenant', 'EDIT', 'CREATE'),
    ).not.toThrow();
    for (const permissions of [['employees:EDIT'], ['users:CREATE'], []]) {
      expect(() =>
        assertAccessActor(
          { ...actor, permissions },
          'tenant',
          'EDIT',
          'CREATE',
        ),
      ).toThrow(ForbiddenException);
    }
  });

  it('keeps administrative bypass tenant-scoped and subject to HR entitlement', () => {
    for (const role of ['TENANT_ADMIN', 'SUPER_ADMIN']) {
      const admin = { ...actor, role, permissions: [] } as RequestUser;
      expect(() =>
        assertAccessActor(admin, 'tenant', 'EDIT', 'CREATE'),
      ).not.toThrow();
      expect(() => assertAccessActor(admin, 'other', 'EDIT', 'CREATE')).toThrow(
        ForbiddenException,
      );
      expect(() =>
        assertAccessActor(
          { ...admin, moduleConfig: { hr: false } },
          'tenant',
          'EDIT',
          'CREATE',
        ),
      ).toThrow(ForbiddenException);
    }
  });

  it.each([undefined, '', 'short', 'contains spaces', 'a'.repeat(129)])(
    'rejects invalid idempotency key %p',
    (key) => {
      expect(() => accessKey(key)).toThrow(BadRequestException);
    },
  );

  it('preserves valid caller keys without generating a replacement', () => {
    expect(accessKey('request:2026-11_12.test')).toBe(
      'request:2026-11_12.test',
    );
  });

  it.each(['changed@example.test', null])(
    'replays an omitted-email grant after contact email changes to %p',
    async (email) => {
      const prior = {
        id: 'operation',
        email: 'original@example.test',
        requestHash: accessFingerprint({
          employeeId: 'employee',
          actorUserId: actor.id,
          email: 'original@example.test',
          employeePermission: 'EDIT',
        }),
      };
      const tx = {
        $queryRaw: jest.fn(),
        employee: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'employee', email, userId: null }),
        },
        employeeAccessOperation: {
          findUnique: jest.fn().mockResolvedValue(prior),
        },
      };
      const service = new EmployeeAccessService(
        { $transaction: (run: (tx: unknown) => unknown) => run(tx) } as never,
        {} as never,
      );
      await expect(
        service.grant('tenant', 'employee', actor, 'request-key'),
      ).resolves.toMatchObject({ id: 'operation' });
    },
  );

  it('returns non-disclosing 404 for an employee outside tenant scope', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { employee: { findFirst } };
    const service = new EmployeeAccessService(prisma as never, {} as never);
    await expect(
      service.read('tenant', 'foreign-employee', actor),
    ).rejects.toThrow(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant', id: 'foreign-employee' },
    });
  });

  it('rejects unauthorized direct service access before touching persistence', async () => {
    const transaction = jest.fn();
    const service = new EmployeeAccessService(
      { $transaction: transaction } as never,
      {} as never,
    );
    await expect(
      service.grant(
        'tenant',
        'employee',
        { ...actor, permissions: ['employees:EDIT'] },
        'request-key',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
