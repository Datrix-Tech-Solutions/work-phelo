/* Real PostgreSQL transactions across three isolated service schemas; no external providers. */
import { randomUUID } from 'crypto';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Module,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { signAccessRpc } from '@work-phelo/internal-auth';
import { EmployeeAccessPatterns, RequestUser } from '@work-phelo/types';
import { PrismaClient } from '../../prisma/generated/client';
import { EmployeeAccessService } from '../../src/employees/employee-access.service';
import { EmployeeAccessRecoveryService as HrRecovery } from '../../src/employees/employee-access-recovery.service';
import { EmployeesService } from '../../src/employees/employees.service';
import { EmploymentType } from '../../prisma/generated/client';
import { EmployeeAccessLinkHandler } from '../../src/employees/employee-access.controller';

const databaseUrl = process.env.EMPLOYEE_ACCESS_TEST_DATABASE_URL;
// Opt-in database suite: a normal CI test discovery must not need cross-service builds.
const load = (path: string) => (databaseUrl ? require(path) : {});
const { PrismaClient: AuthClient } = load(
  '../../../auth-service/prisma/generated/client',
);
const { PrismaClient: NotifyClient } = load(
  '../../../notification-service/prisma/generated/client',
);
const { EmployeeAccessCommandService } = load(
  '../../../auth-service/dist/users/employee-access-command.service',
);
const { EmployeeAccessCommandHandler } = load(
  '../../../auth-service/dist/users/employee-access-command.handler',
);
const { EmployeeAccessLifecycleService } = load(
  '../../../auth-service/dist/users/employee-access-lifecycle.service',
);
const { EmployeeAccessRecoveryService: AuthRecovery } = load(
  '../../../auth-service/dist/users/employee-access-recovery.service',
);
const { EmployeeAccessInviteService, EmployeeAccessInviteHandler } = load(
  '../../../notification-service/dist/notification/employee-access-invite.handler',
);
const { JwtStrategy } = load(
  '../../../auth-service/dist/auth/strategies/jwt.strategy',
);
const { UsersService } = load('../../../auth-service/dist/users/users.service');
const suite = databaseUrl ? describe : describe.skip;
suite('Durable employee access (disposable PostgreSQL only)', () => {
  let hr: PrismaClient;
  let auth: any;
  let notify: any;
  let access: EmployeeAccessService;
  let recovery: HrRecovery;
  let commands: any;
  let handlers: any;
  let delivery: any;
  let lifecycle: any;
  let employees: EmployeesService;
  let actor: RequestUser;
  let employee: any;
  let tenantId: string;
  let hrRpc: any;
  let authRpc: any;
  let email: any;
  let leave: any;
  let baseline: any;
  const savedEnv = { ...process.env };

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    const hostOverride = url.searchParams.get('host');
    if (
      hostOverride &&
      !hostOverride.startsWith('/') &&
      !['localhost', '127.0.0.1'].includes(hostOverride)
    ) {
      throw new Error('Refusing remote database host override');
    }
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.startsWith('/employee_access_test_')
    ) {
      throw new Error('Refusing non-disposable employee-access database');
    }
    const schemaUrl = (schema: string) => {
      const copy = new URL(databaseUrl!);
      copy.searchParams.set('schema', schema);
      return copy.toString();
    };
    hr = new PrismaClient({ datasources: { db: { url: schemaUrl('hr') } } });
    auth = new AuthClient({
      datasources: { db: { url: schemaUrl('w_auth') } },
    });
    notify = new NotifyClient({
      datasources: { db: { url: schemaUrl('notify') } },
    });
    process.env.INTERNAL_SERVICE_AUTH_SECRET =
      'local-integration-only-employee-access-secret-12345';
    process.env.SUPER_ADMIN_EMAIL = 'platform-owner@example.test';
    process.env.FRONTEND_BASE_URL = 'http://localhost:3000';
    await hr.$connect();
    await auth.$connect();
    await notify.$connect();
  });
  afterAll(async () => {
    await hr?.$disconnect();
    await auth?.$disconnect();
    await notify?.$disconnect();
    for (const key of [
      'INTERNAL_SERVICE_AUTH_SECRET',
      'SUPER_ADMIN_EMAIL',
      'FRONTEND_BASE_URL',
    ]) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  beforeEach(async () => {
    tenantId = randomUUID();
    await auth.tenant.create({
      data: {
        id: tenantId,
        name: 'Test tenant',
        slug: `access-${tenantId}`,
        email: `${tenantId}@example.test`,
        status: 'ACTIVE',
        moduleConfig: { hr: true },
      },
    });
    const admin = await auth.user.create({
      data: {
        tenantId,
        email: `admin-${tenantId}@example.test`,
        firstName: 'Admin',
        lastName: 'Test',
        role: 'TENANT_ADMIN',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });
    actor = {
      id: admin.id,
      tenantId,
      role: 'TENANT_ADMIN',
      email: admin.email,
      firstName: admin.firstName,
      tenantSlug: `access-${tenantId}`,
      tenantName: 'Test tenant',
      moduleConfig: { hr: true },
      featureConfig: {},
      permissions: [],
    };
    const dept = await hr.department.create({ data: { tenantId, name: 'HR' } });
    employee = await hr.employee.create({
      data: {
        tenantId,
        firstName: 'Ama',
        lastName: 'Test',
        employeeNumber: 'EMP-0001',
        email: `person-${tenantId}@example.test`,
        jobTitle: 'Officer',
        hireDate: new Date('2026-01-01'),
        basicSalary: 1000,
        employmentStatus: 'ACTIVE',
        departmentId: dept.id,
      },
    });
    baseline = await auth.permissionSet.create({
      data: { tenantId, name: 'Employee' },
    });
    email = { sendEmployeeInviteEmail: jest.fn().mockResolvedValue(true) };
    delivery = new EmployeeAccessInviteService(notify, email);
    const deliveryHandler = new EmployeeAccessInviteHandler(delivery);
    hrRpc = {
      employeeAccessSnapshot: jest.fn(async (payload) =>
        handlers.snapshot(
          signAccessRpc('hr-service', EmployeeAccessPatterns.snapshot, payload),
        ),
      ),
      recoverEmployeeAccess: jest.fn(async (payload) =>
        handlers.recover(
          signAccessRpc('hr-service', EmployeeAccessPatterns.recover, payload),
        ),
      ),
      employeeAccessLifecycle: jest.fn(async (payload) =>
        handlers.executeLifecycle(
          signAccessRpc(
            'hr-service',
            EmployeeAccessPatterns.lifecycle,
            payload,
          ),
        ),
      ),
      employeeAccessAccount: jest.fn(async (payload) =>
        handlers.account(
          signAccessRpc('hr-service', EmployeeAccessPatterns.account, payload),
        ),
      ),
      employeeAccessCommand: jest.fn(async (pattern, payload) => {
        const envelope = signAccessRpc('hr-service', pattern, payload);
        if (pattern === EmployeeAccessPatterns.execute)
          return handlers.execute(envelope);
        if (pattern === EmployeeAccessPatterns.finalize)
          return handlers.finalize(envelope);
        return handlers.status(envelope);
      }),
      authGetUserStatuses: jest.fn(async ({ tenantId: scope, userIds }) =>
        (
          await auth.user.findMany({
            where: { tenantId: scope, id: { in: userIds } },
          })
        ).map((u: { id: string; status: string }) => ({
          userId: u.id,
          status: u.status,
        })),
      ),
    };
    access = new EmployeeAccessService(hr as never, hrRpc);
    authRpc = {
      inspectEmployeeInvite: jest.fn((payload) =>
        deliveryHandler.inspect(
          signAccessRpc(
            'auth-service',
            EmployeeAccessPatterns.receipt,
            payload,
          ),
        ),
      ),
      verifyEmployeeOffboarded: jest.fn((payload) =>
        access.verifyOffboarded(
          signAccessRpc(
            'auth-service',
            EmployeeAccessPatterns.offboarded,
            payload,
          ),
        ),
      ),
      verifyEmployeeAccessLink: jest.fn((ref) =>
        access.verifyLink(
          signAccessRpc('auth-service', EmployeeAccessPatterns.verifyLink, ref),
        ),
      ),
      sendEmployeeAccessInvite: jest.fn((payload) =>
        deliveryHandler.deliver(
          signAccessRpc('auth-service', EmployeeAccessPatterns.notify, payload),
        ),
      ),
    };
    commands = new EmployeeAccessCommandService(
      auth,
      new JwtStrategy(auth, { getOrThrow: () => 'integration-jwt-secret' }),
      authRpc,
    );
    lifecycle = new EmployeeAccessLifecycleService(
      auth,
      new JwtStrategy(auth, { getOrThrow: () => 'integration-jwt-secret' }),
      authRpc,
    );
    handlers = new EmployeeAccessCommandHandler(
      commands,
      lifecycle,
      new AuthRecovery(
        auth,
        new JwtStrategy(auth, { getOrThrow: () => 'integration-jwt-secret' }),
        authRpc,
      ),
    );
    recovery = new HrRecovery(hr as never, hrRpc, access);
    leave = {
      initializeLeaveBalances: jest.fn().mockResolvedValue(undefined),
      ensurePublicHolidaysSeededForEmployee: jest
        .fn()
        .mockResolvedValue(undefined),
    };
    employees = new EmployeesService(
      hr as never,
      hrRpc,
      leave,
      {} as never,
      {
        encrypt: (v: unknown) => v,
        hmac: (v: string) => `hash:${v}`,
        decryptEmployeeFields: (v: unknown) => v,
        maskListFields: (v: unknown) => v,
      } as never,
      { resolveMany: async (v: unknown) => v } as never,
      {} as never,
      {} as never,
      access,
    );
  });

  const key = () => randomUUID();
  async function grant() {
    return access.grant(tenantId, employee.id, actor, key());
  }
  async function finish(op: { id: string }) {
    await access.process(op.id);
    await commands.publishOne(op.id);
    await access.process(op.id);
  }
  async function payloadFor(id: string) {
    const op = await hr.employeeAccessOperation.findUniqueOrThrow({
      where: { id },
    });
    return {
      operationId: id,
      tenantId,
      employeeId: employee.id,
      actorUserId: actor.id,
      idempotencyKey: op.idempotencyKey,
      requestHash: op.requestHash,
      employeePermission: op.employeePermission,
      email: op.email,
      firstName: op.firstName,
      lastName: op.lastName,
    };
  }

  it('does not overwrite a suspension committed between generic Auth update checks and its write', async () => {
    const target = await auth.user.create({
      data: {
        tenantId,
        email: `cas-${tenantId}@example.test`,
        firstName: 'CAS',
        lastName: 'Test',
        role: 'EMPLOYEE',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });
    const transact = auth.$transaction.bind(auth);
    const suspension = new Date();
    const intercepted = jest
      .spyOn(auth, '$transaction')
      .mockImplementationOnce(async (run: any) => {
        await auth.user.update({
          where: { id: target.id },
          data: {
            status: 'SUSPENDED',
            accessSuspendedAt: suspension,
            sessionVersion: { increment: 1 },
          },
        });
        return transact(run);
      });
    try {
      await expect(
        new UsersService(auth, {}, {}, {}, {}).update(
          tenantId,
          target.id,
          { status: 'ACTIVE' },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
      expect(
        await auth.user.findUniqueOrThrow({ where: { id: target.id } }),
      ).toMatchObject({
        status: 'SUSPENDED',
        accessSuspendedAt: suspension,
        sessionVersion: 1,
      });
    } finally {
      intercepted.mockRestore();
    }
  });

  (process.env.EMPLOYEE_ACCESS_TEST_RABBITMQ_URL ? it : it.skip)(
    'provisions and reconciles lost replies through real isolated RabbitMQ with provider deduplication',
    async () => {
      const url = new URL(process.env.EMPLOYEE_ACCESS_TEST_RABBITMQ_URL!);
      if (
        !['127.0.0.1', 'localhost'].includes(url.hostname) ||
        url.port !== '55673'
      )
        throw new Error('Refusing non-disposable employee-access broker');
      const servers: any[] = [];
      const clients: any[] = [];
      const start = async (name: string, controller: any, providers: any[]) => {
        class TestRpcModule {}
        Module({ controllers: [controller], providers })(TestRpcModule);
        const options = {
          transport: Transport.RMQ as const,
          options: {
            urls: [url.toString()],
            queue: `employee-access-test-${tenantId}-${name}`,
            queueOptions: { durable: false, autoDelete: true },
            noAck: false,
            prefetchCount: 10,
          },
        };
        const server = await NestFactory.createMicroservice(TestRpcModule, {
          ...options,
          logger: false,
        });
        servers.push(server);
        await server.listen();
        // RabbitMQ direct-reply-to consumers require auto-ack; request servers use manual ack.
        const client = ClientProxyFactory.create({
          ...options,
          options: { ...options.options, noAck: true },
        });
        clients.push(client);
        await client.connect();
        return (
          pattern: string,
          payload: any,
          service: 'hr-service' | 'auth-service',
        ) =>
          firstValueFrom(
            client
              .send(pattern, signAccessRpc(service, pattern, payload))
              .pipe(timeout(5000)),
          );
      };
      try {
        const authSend = await start('auth', EmployeeAccessCommandHandler, [
          { provide: EmployeeAccessCommandService, useValue: commands },
          { provide: EmployeeAccessLifecycleService, useValue: lifecycle },
          {
            provide: AuthRecovery,
            useValue: new AuthRecovery(
              auth,
              new JwtStrategy(auth, {
                getOrThrow: () => 'integration-jwt-secret',
              }),
              authRpc,
            ),
          },
        ]);
        const hrSend = await start('hr', EmployeeAccessLinkHandler, [
          { provide: EmployeeAccessService, useValue: access },
        ]);
        const notifySend = await start(
          'notification',
          EmployeeAccessInviteHandler,
          [{ provide: EmployeeAccessInviteService, useValue: delivery }],
        );
        hrRpc.employeeAccessCommand.mockImplementation(
          (pattern: string, payload: any) =>
            authSend(pattern, payload, 'hr-service'),
        );
        authRpc.verifyEmployeeAccessLink.mockImplementation((payload: any) =>
          hrSend(EmployeeAccessPatterns.verifyLink, payload, 'auth-service'),
        );
        authRpc.sendEmployeeAccessInvite.mockImplementation((payload: any) =>
          notifySend(EmployeeAccessPatterns.notify, payload, 'auth-service'),
        );
        authRpc.inspectEmployeeInvite.mockImplementation((payload: any) =>
          notifySend(EmployeeAccessPatterns.receipt, payload, 'auth-service'),
        );
        const op = await grant();
        hrRpc.employeeAccessCommand.mockImplementationOnce(
          async (pattern: string, payload: any) => {
            await authSend(pattern, payload, 'hr-service');
            throw new Error('Lost successful broker reply');
          },
        );
        await access.process(op.id);
        await finish(op);
        const command = await auth.employeeAccessCommand.findUniqueOrThrow({
          where: { id: op.id },
        });
        expect(command.status).toBe('PROVIDER_ACCEPTED');
        expect(
          await auth.user.count({ where: { tenantId, email: employee.email } }),
        ).toBe(1);
        const receipt = await notifySend(
          EmployeeAccessPatterns.receipt,
          { operationId: op.id, tenantId, userId: command.targetUserId },
          'auth-service',
        );
        expect(receipt).toMatchObject({ status: 'PROVIDER_ACCEPTED' });
        const ref = access.reference(
          await hr.employeeAccessOperation.findUniqueOrThrow({
            where: { id: op.id },
          }),
        );
        // Exceed production prefetch=10 on every manual-ack consumer, including rejected RPCs.
        for (let i = 0; i < 25; i++) {
          await authSend(EmployeeAccessPatterns.status, ref, 'hr-service');
          await expect(
            authSend(
              EmployeeAccessPatterns.status,
              { ...ref, requestHash: 'invalid' },
              'hr-service',
            ),
          ).rejects.toMatchObject({ statusCode: 409 });
          expect(
            await hrSend(
              EmployeeAccessPatterns.verifyLink,
              ref,
              'auth-service',
            ),
          ).toMatchObject({ linked: true });
          expect(
            await notifySend(
              EmployeeAccessPatterns.notify,
              authRpc.sendEmployeeAccessInvite.mock.calls[0][0],
              'auth-service',
            ),
          ).toMatchObject({ status: 'PROVIDER_ACCEPTED' });
        }
        await finish(op);
        expect(email.sendEmployeeInviteEmail).toHaveBeenCalledTimes(1);
      } finally {
        for (const client of clients) await client.close();
        for (const server of servers.reverse()) await server.close();
      }
    },
    30000,
  );

  it('accepts an access request with employee creation while Auth is unavailable; replay creates no duplicate', async () => {
    const dto = {
      firstName: 'Kofi',
      lastName: 'Test',
      email: `new-${tenantId}@example.test`,
      departmentId: employee.departmentId,
      jobTitle: 'Officer',
      hireDate: '2026-01-01',
      employmentType: EmploymentType.FULL_TIME,
      grantSystemAccess: true,
    };
    hrRpc.employeeAccessCommand.mockRejectedValue(new Error('Auth down'));
    const options = { actor, idempotencyKey: key() };
    const [first, replay] = await Promise.all([
      employees.create(tenantId, dto, options),
      employees.create(tenantId, dto, options),
    ]);
    expect(first.id).toBe(replay.id);
    expect(first.userId).toBeNull();
    expect(first.systemAccessOperation?.status).toBe('QUEUED');
    expect(hrRpc.employeeAccessCommand).not.toHaveBeenCalled();
    expect(await hr.employee.count({ where: { tenantId } })).toBe(2);
    await access.process(first.systemAccessOperation!.id);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: first.systemAccessOperation!.id },
        })
      ).status,
    ).toBe('RECONCILING');
  });

  it('replays email-less default employee creation without provisioning', async () => {
    const dto = {
      firstName: 'No',
      lastName: 'Email',
      departmentId: employee.departmentId,
      jobTitle: 'Officer',
      hireDate: '2026-01-01',
      employmentType: EmploymentType.FULL_TIME,
    };
    const options = { actor, idempotencyKey: key() };
    const first = await employees.create(tenantId, dto, options);
    const second = await employees.create(tenantId, dto, options);
    expect(first.id).toBe(second.id);
    expect(first.email).toBeNull();
    expect(
      await hr.employeeAccessOperation.count({ where: { tenantId } }),
    ).toBe(0);
    expect(hrRpc.employeeAccessCommand).not.toHaveBeenCalled();
  });

  it('rolls back the employee, operation and create receipt when HR onboarding fails', async () => {
    leave.initializeLeaveBalances.mockRejectedValue(
      new Error('balance write failed'),
    );
    await expect(
      employees.create(
        tenantId,
        {
          firstName: 'Bad',
          lastName: 'Setup',
          email: `bad-${tenantId}@example.test`,
          departmentId: employee.departmentId,
          jobTitle: 'Officer',
          hireDate: '2026-01-01',
          employmentType: EmploymentType.FULL_TIME,
          grantSystemAccess: true,
        },
        { actor, idempotencyKey: key() },
      ),
    ).rejects.toThrow('balance write failed');
    expect(await hr.employee.count({ where: { tenantId } })).toBe(1);
    expect(
      await hr.employeeAccessOperation.count({ where: { tenantId } }),
    ).toBe(0);
    expect(await hr.employeeCreateRequest.count({ where: { tenantId } })).toBe(
      0,
    );
  });

  it('requires users:CREATE and employee target authority at direct service boundaries', async () => {
    await expect(
      access.grant(
        tenantId,
        employee.id,
        { ...actor, role: 'EMPLOYEE', permissions: ['employees:EDIT'] },
        key(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      access.grant(
        tenantId,
        employee.id,
        { ...actor, role: 'EMPLOYEE', permissions: ['users:CREATE'] },
        key(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      access.grant(
        tenantId,
        employee.id,
        { ...actor, tenantId: 'other' },
        key(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      employees.create(tenantId, {
        firstName: 'No',
        lastName: 'Permission',
        grantSystemAccess: true,
        email: 'valid@example.test',
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not reveal cross-tenant targets and rejects missing email or offboarded employees', async () => {
    const foreign = await hr.employee.create({
      data: {
        tenantId: randomUUID(),
        employeeNumber: 'EMP-0001',
        firstName: 'Foreign',
        lastName: 'Employee',
        jobTitle: 'Officer',
        hireDate: new Date(),
        basicSalary: 100,
      },
    });
    await expect(
      access.grant(tenantId, foreign.id, actor, key()),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      access.grant(tenantId, randomUUID(), actor, key()),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      access.grant(
        randomUUID(),
        employee.id,
        { ...actor, tenantId: randomUUID() },
        key(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await hr.employee.update({
      where: { id: employee.id },
      data: { email: null },
    });
    await expect(grant()).rejects.toThrow('valid login email');
    await hr.employee.update({
      where: { id: employee.id },
      data: { email: 'valid@example.test', employmentStatus: 'OFFBOARDED' },
    });
    await expect(grant()).rejects.toBeInstanceOf(ConflictException);
  });

  it('accepts an explicit login email without overwriting an employee contact email', async () => {
    await hr.employee.update({
      where: { id: employee.id },
      data: { email: null },
    });
    const op = await access.grant(
      tenantId,
      employee.id,
      actor,
      key(),
      `login-${tenantId}@example.test`,
    );
    await finish(op);
    expect(
      (await hr.employee.findUniqueOrThrow({ where: { id: employee.id } }))
        .email,
    ).toBeNull();
    expect(email.sendEmployeeInviteEmail).toHaveBeenCalledTimes(1);
  });

  it('deduplicates simultaneous identical grants and blocks competing keys and altered payloads', async () => {
    const idempotencyKey = key();
    const [a, b] = await Promise.all([
      access.grant(tenantId, employee.id, actor, idempotencyKey),
      access.grant(tenantId, employee.id, actor, idempotencyKey),
    ]);
    expect(a.id).toBe(b.id);
    await expect(
      access.grant(
        tenantId,
        employee.id,
        actor,
        idempotencyKey,
        'changed@example.test',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(grant()).rejects.toBeInstanceOf(ConflictException);
    expect(
      await hr.employeeAccessOperation.count({ where: { tenantId } }),
    ).toBe(1);
  });

  it('provisions once, assigns only the baseline and sends nothing before confirmed linking', async () => {
    const op = await grant();
    const payload = await payloadFor(op.id);
    const beforeResources = await auth.resource.count();
    const [a, b] = await Promise.all([
      commands.execute(payload),
      commands.execute(payload),
    ]);
    expect(a.userId).toBe(b.userId);
    expect(
      await auth.userPermissionSet.count({
        where: { userId: a.userId, permissionSetId: baseline.id },
      }),
    ).toBe(1);
    expect(await auth.resource.count()).toBe(beforeResources);
    await commands.publishOne(op.id);
    expect(email.sendEmployeeInviteEmail).not.toHaveBeenCalled();
    await expect(
      commands.finalize({
        operationId: op.id,
        tenantId,
        employeeId: employee.id,
        actorUserId: actor.id,
        requestHash: payload.requestHash,
        userId: a.userId,
      }),
    ).rejects.toThrow('LINK_NOT_CONFIRMED');
    await finish(op);
    expect(
      (await hr.employee.findUniqueOrThrow({ where: { id: employee.id } }))
        .userId,
    ).toBe(a.userId);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).status,
    ).toBe('COMPLETED');
    expect(email.sendEmployeeInviteEmail).toHaveBeenCalledTimes(1);
    expect(email.sendEmployeeInviteEmail.mock.calls[0][4]).toBe(
      `employee-access/${op.id}`,
    );
    expect(
      await auth.auditLog.count({ where: { tenantId, resourceId: a.userId } }),
    ).toBe(1);
  });

  it('rejects forged signatures and cross-tenant finalization without modifying links', async () => {
    const op = await grant();
    const payload = await payloadFor(op.id);
    const signed = signAccessRpc(
      'hr-service',
      EmployeeAccessPatterns.execute,
      payload,
    );
    await expect(
      handlers.execute({
        ...signed,
        payload: { ...payload, actorUserId: randomUUID() },
      }),
    ).rejects.toBeDefined();
    await expect(
      handlers.execute({ payload, proof: undefined }),
    ).rejects.toBeDefined();
    const created = await commands.execute(payload);
    await expect(
      commands.finalize({
        operationId: op.id,
        tenantId: randomUUID(),
        employeeId: employee.id,
        actorUserId: actor.id,
        requestHash: payload.requestHash,
        userId: created.userId,
      }),
    ).rejects.toThrow('COMMAND_SCOPE_MISMATCH');
    expect(
      (await hr.employee.findUniqueOrThrow({ where: { id: employee.id } }))
        .userId,
    ).toBeNull();
  });

  it('rechecks revoked actors before deferred execution', async () => {
    const op = await grant();
    await auth.user.update({
      where: { id: actor.id },
      data: { role: 'EMPLOYEE' },
    });
    await access.process(op.id);
    const failed = await hr.employeeAccessOperation.findUniqueOrThrow({
      where: { id: op.id },
    });
    expect(failed.status).toBe('FAILED');
    expect(failed.lastErrorCode).toBe('ACTOR_PERMISSION_REVOKED');
    expect(await auth.user.count({ where: { tenantId } })).toBe(1);
    expect(email.sendEmployeeInviteEmail).not.toHaveBeenCalled();
  });

  it('blocks publication if actor privileges are revoked after provisioning/linking', async () => {
    const op = await grant();
    await access.process(op.id);
    await auth.user.update({
      where: { id: actor.id },
      data: { role: 'EMPLOYEE' },
    });
    await commands.publishOne(op.id);
    expect(
      (await auth.employeeAccessCommand.findUnique({ where: { id: op.id } }))
        .status,
    ).toBe('PAUSED');
    expect(email.sendEmployeeInviteEmail).not.toHaveBeenCalled();
  });

  it.each(['EMPLOYEE', 'TENANT_ADMIN', 'SUPER_ADMIN'])(
    'rejects existing %s email conflicts, without linking or altering the account',
    async (role) => {
      const existing = await auth.user.create({
        data: {
          tenantId,
          email: employee.email,
          firstName: 'Existing',
          lastName: 'Identity',
          role,
          status: 'ACTIVE',
        },
      });
      const op = await grant();
      await access.process(op.id);
      expect(
        (
          await hr.employeeAccessOperation.findUniqueOrThrow({
            where: { id: op.id },
          })
        ).lastErrorCode,
      ).toBe('IDENTITY_CONFLICT');
      expect(
        (await hr.employee.findUniqueOrThrow({ where: { id: employee.id } }))
          .userId,
      ).toBeNull();
      expect(
        (await auth.user.findUnique({ where: { id: existing.id } })).status,
      ).toBe('ACTIVE');
    },
  );

  it('fails explicitly when baseline configuration is missing without creating a user', async () => {
    await auth.permissionSet.delete({ where: { id: baseline.id } });
    const op = await grant();
    await access.process(op.id);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).lastErrorCode,
    ).toBe('EMPLOYEE_BASELINE_MISSING');
    expect(await auth.user.count({ where: { tenantId } })).toBe(1);
  });

  it('recovers a committed Auth identity after an RPC lost reply and worker restart', async () => {
    const op = await grant();
    const original = hrRpc.employeeAccessCommand.getMockImplementation();
    hrRpc.employeeAccessCommand.mockImplementationOnce(
      async (pattern: string, payload: unknown) => {
        await original(pattern, payload);
        throw new Error('reply lost');
      },
    );
    await access.process(op.id);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).status,
    ).toBe('RECONCILING');
    access = new EmployeeAccessService(hr as never, hrRpc);
    await finish(op);
    expect(
      await auth.user.count({ where: { tenantId, email: employee.email } }),
    ).toBe(1);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).status,
    ).toBe('COMPLETED');
  });

  it('preserves a conflicting existing link without deleting the newly provisioned pending identity', async () => {
    const op = await grant();
    const provisioned = await commands.execute(await payloadFor(op.id));
    const existingLink = randomUUID();
    await hr.employee.update({
      where: { id: employee.id },
      data: { userId: existingLink },
    });
    await access.process(op.id);
    expect(
      (await hr.employee.findUniqueOrThrow({ where: { id: employee.id } }))
        .userId,
    ).toBe(existingLink);
    expect(
      await auth.user.findUnique({ where: { id: provisioned.userId } }),
    ).not.toBeNull();
    expect(email.sendEmployeeInviteEmail).not.toHaveBeenCalled();
  });

  it('recovers a lost finalization reply without publishing twice', async () => {
    const op = await grant();
    const original = hrRpc.employeeAccessCommand.getMockImplementation();
    let lost = false;
    hrRpc.employeeAccessCommand.mockImplementation(
      async (pattern: string, payload: unknown) => {
        const result = await original(pattern, payload);
        if (pattern === EmployeeAccessPatterns.finalize && !lost) {
          lost = true;
          throw new Error('reply lost');
        }
        return result;
      },
    );
    await access.process(op.id);
    await finish(op);
    await commands.publishOne(op.id);
    expect(email.sendEmployeeInviteEmail).toHaveBeenCalledTimes(1);
  });

  it('replays Notification acknowledgment after provider acceptance without a second provider send', async () => {
    const op = await grant();
    await access.process(op.id);
    const original = authRpc.sendEmployeeAccessInvite.getMockImplementation();
    authRpc.sendEmployeeAccessInvite.mockImplementationOnce(
      async (payload: unknown) => {
        await original(payload);
        throw new Error('ack lost');
      },
    );
    await commands.publishOne(op.id);
    await commands.publishOne(op.id);
    await access.process(op.id);
    expect(email.sendEmployeeInviteEmail).toHaveBeenCalledTimes(1);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).status,
    ).toBe('COMPLETED');
  });

  it('retries provider failure without deleting employee or identity', async () => {
    const op = await grant();
    await access.process(op.id);
    email.sendEmployeeInviteEmail.mockResolvedValueOnce(false);
    await commands.publishOne(op.id);
    expect(
      (await auth.employeeAccessCommand.findUnique({ where: { id: op.id } }))
        .status,
    ).toBe('READY');
    await commands.publishOne(op.id);
    await access.process(op.id);
    expect(email.sendEmployeeInviteEmail).toHaveBeenCalledTimes(2);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).status,
    ).toBe('COMPLETED');
  });

  it('recovers expired leases and visibly pauses exhausted uncertain operations', async () => {
    const op = await grant();
    await hr.employeeAccessOperation.update({
      where: { id: op.id },
      data: {
        status: 'RUNNING',
        leaseToken: 'dead-worker',
        leaseUntil: new Date(Date.now() - 1000),
      },
    });
    await access.process(op.id);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).status,
    ).toBe('LINKED');
    await hr.employeeAccessOperation.update({
      where: { id: op.id },
      data: { attemptCount: 7 },
    });
    hrRpc.employeeAccessCommand.mockRejectedValue(new Error('offline'));
    await access.process(op.id);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).status,
    ).toBe('PAUSED');
    await expect(grant()).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns unavailable, not active or absent, on Auth lookup failure and scopes operation reads', async () => {
    const op = await grant();
    await access.process(op.id);
    hrRpc.employeeAccessAccount.mockRejectedValue(new Error('offline'));
    expect((await access.read(tenantId, employee.id, actor)).status).toBe(
      'UNAVAILABLE',
    );
    await expect(
      access.readOperation(tenantId, randomUUID(), op.id, actor),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      access.readOperation(tenantId, employee.id, op.id, {
        ...actor,
        role: 'EMPLOYEE',
        permissions: ['employees:VIEW'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const result = await access.readOperation(
      tenantId,
      employee.id,
      op.id,
      actor,
    );
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('inviteToken');
    expect(result).not.toHaveProperty('requestHash');
  });

  it('legacy cleanup cannot delete a durable identity and generic resend cannot bypass finalization', async () => {
    const op = await grant();
    const result = await commands.execute(await payloadFor(op.id));
    const users = new UsersService(auth, {}, {}, {}, {});
    await expect(
      users.deletePendingEmployeeInvite(tenantId, {
        userId: result.userId,
        email: employee.email,
      }),
    ).resolves.toEqual({ deleted: false });
    await expect(
      users.resendInvite(tenantId, result.userId),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      users.update(tenantId, result.userId, { status: 'ACTIVE' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects create replay with a changed payload without creating another employee', async () => {
    const dto = {
      firstName: 'One',
      lastName: 'Employee',
      departmentId: employee.departmentId,
      jobTitle: 'Officer',
      hireDate: '2026-01-01',
      employmentType: EmploymentType.FULL_TIME,
    };
    const options = { actor, idempotencyKey: key() };
    await employees.create(tenantId, dto, options);
    await expect(
      employees.create(tenantId, { ...dto, firstName: 'Changed' }, options),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await hr.employee.count({ where: { tenantId } })).toBe(2);
  });

  it('rejects changed Auth command payloads and does not mutate the successful command', async () => {
    const op = await grant();
    const payload = await payloadFor(op.id);
    const created = await commands.execute(payload);
    await expect(
      commands.execute({ ...payload, email: 'changed@example.test' }),
    ).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    expect(
      (await auth.employeeAccessCommand.findUnique({ where: { id: op.id } }))
        .targetUserId,
    ).toBe(created.userId);
    expect(await auth.user.count({ where: { tenantId } })).toBe(2);
  });

  it('rolls back Auth user creation when baseline assignment fails inside the transaction', async () => {
    const op = await grant();
    const payload = await payloadFor(op.id);
    const transaction = auth.$transaction.bind(auth);
    const failingPrisma = new Proxy(auth, {
      get(target, field) {
        if (field === '$transaction')
          return (callback: (tx: any) => Promise<unknown>, options: unknown) =>
            transaction(
              (tx: any) =>
                callback(
                  new Proxy(tx, {
                    get(inner, model) {
                      if (model === 'userPermissionSet')
                        return {
                          ...inner.userPermissionSet,
                          create: async () => {
                            throw new Error('assignment failed');
                          },
                        };
                      return Reflect.get(inner, model);
                    },
                  }),
                ),
              options,
            );
        return Reflect.get(target, field);
      },
    });
    const failing = new EmployeeAccessCommandService(
      failingPrisma,
      new JwtStrategy(auth, { getOrThrow: () => 'integration-jwt-secret' }),
      authRpc,
    );
    await expect(failing.execute(payload)).rejects.toThrow('assignment failed');
    expect(await auth.user.count({ where: { tenantId } })).toBe(1);
    expect(
      await auth.employeeAccessCommand.count({ where: { tenantId } }),
    ).toBe(0);
  });

  it('database uniqueness prevents one identity from being linked to two employees', async () => {
    const op = await grant();
    await access.process(op.id);
    const linked = await hr.employee.findUniqueOrThrow({
      where: { id: employee.id },
    });
    await expect(
      hr.employee.create({
        data: {
          tenantId,
          employeeNumber: 'EMP-0002',
          firstName: 'Other',
          lastName: 'Employee',
          jobTitle: 'Officer',
          hireDate: new Date(),
          basicSalary: 100,
          userId: linked.userId,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(
      (await hr.employee.findUniqueOrThrow({ where: { id: employee.id } }))
        .userId,
    ).toBe(linked.userId);
  });

  it('rejects existing and self-directed links and disabled HR entitlement', async () => {
    await hr.employee.update({
      where: { id: employee.id },
      data: { userId: actor.id },
    });
    await expect(grant()).rejects.toBeInstanceOf(ForbiddenException);
    await hr.employee.update({
      where: { id: employee.id },
      data: { userId: randomUUID() },
    });
    await expect(grant()).rejects.toBeInstanceOf(ConflictException);
    await expect(
      access.grant(
        tenantId,
        employee.id,
        { ...actor, moduleConfig: { hr: false } },
        key(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechecks a disabled tenant module at Auth execution time', async () => {
    const op = await grant();
    await auth.tenant.update({
      where: { id: tenantId },
      data: { moduleConfig: { hr: false } },
    });
    await access.process(op.id);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).lastErrorCode,
    ).toBe('ACTOR_PERMISSION_REVOKED');
    expect(await auth.user.count({ where: { tenantId } })).toBe(1);
  });

  it('expires unsent invitations without deleting their employee or identity', async () => {
    const op = await grant();
    await access.process(op.id);
    const command = await auth.employeeAccessCommand.findUnique({
      where: { id: op.id },
    });
    await auth.user.update({
      where: { id: command.targetUserId },
      data: { inviteExpiresAt: new Date(0) },
    });
    await commands.publishOne(op.id);
    await access.process(op.id);
    expect(
      (await auth.employeeAccessCommand.findUnique({ where: { id: op.id } }))
        .status,
    ).toBe('EXPIRED');
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).status,
    ).toBe('PAUSED');
    expect(email.sendEmployeeInviteEmail).not.toHaveBeenCalled();
    expect(
      await auth.user.findUnique({ where: { id: command.targetUserId } }),
    ).not.toBeNull();
    const recovered = await recovery.reconcile(
      tenantId,
      employee.id,
      op.id,
      actor,
      key(),
      'Renew expired invitation',
    );
    expect(recovered).toMatchObject({
      outcome: 'FAILED',
      errorCode: 'INVITATION_EXPIRED_RESEND_REQUIRED',
    });
    const resend = await access.lifecycle(
      tenantId,
      employee.id,
      actor,
      key(),
      'RESEND',
      'New authorized invitation',
    );
    await access.process(resend.id);
    await lifecycle.publishOne(resend.id);
    await access.process(resend.id);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: resend.id },
        })
      ).status,
    ).toBe('COMPLETED');
    expect(
      (await recovery.history(tenantId, employee.id, op.id, actor))[0].reason,
    ).toBe('Renew expired invitation');
  });

  async function activeEmployeeLink() {
    const user = await auth.user.create({
      data: {
        tenantId,
        email: `active-${randomUUID()}@example.test`,
        firstName: 'Active',
        lastName: 'Employee',
        role: 'EMPLOYEE',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });
    await auth.userPermissionSet.create({
      data: {
        userId: user.id,
        permissionSetId: baseline.id,
        grantedBy: actor.id,
      },
    });
    await hr.employee.update({
      where: { id: employee.id },
      data: { userId: user.id },
    });
    return user;
  }

  it('suspends and restores atomically without restoring any old session or changing employment/permissions', async () => {
    const user = await activeEmployeeLink();
    await auth.refreshToken.create({
      data: {
        userId: user.id,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    const strategy = new JwtStrategy(auth, {
      getOrThrow: () => 'integration-secret',
    });
    const claims = { sub: user.id, tenantId, sessionVersion: 0 };
    await expect(strategy.validate(claims)).resolves.toHaveProperty(
      'id',
      user.id,
    );
    const suspend = await access.lifecycle(
      tenantId,
      employee.id,
      actor,
      key(),
      'SUSPEND',
      'Review requested',
    );
    expect(
      (await access.read(tenantId, employee.id, actor)).pendingAction,
    ).toBe('SUSPEND');
    await access.process(suspend.id);
    expect((await access.read(tenantId, employee.id, actor)).status).toBe(
      'SUSPENDED',
    );
    await expect(strategy.validate(claims)).rejects.toThrow();
    expect(
      await auth.refreshToken.count({
        where: { userId: user.id, isRevoked: false },
      }),
    ).toBe(0);
    const restore = await access.lifecycle(
      tenantId,
      employee.id,
      actor,
      key(),
      'RESTORE',
      'Review completed',
    );
    await access.process(restore.id);
    expect((await access.read(tenantId, employee.id, actor)).status).toBe(
      'ACTIVE',
    );
    await expect(strategy.validate(claims)).rejects.toThrow();
    await expect(
      strategy.validate({ ...claims, sessionVersion: 2 }),
    ).resolves.toHaveProperty('id', user.id);
    expect(
      await auth.userPermissionSet.count({ where: { userId: user.id } }),
    ).toBe(1);
    expect(
      (await hr.employee.findUniqueOrThrow({ where: { id: employee.id } }))
        .employmentStatus,
    ).toBe('ACTIVE');
  });

  it('deduplicates simultaneous lifecycle keys and rejects different payloads or competing actions', async () => {
    const user = await activeEmployeeLink();
    const requestKey = key();
    const [first, second] = await Promise.all([
      access.lifecycle(
        tenantId,
        employee.id,
        actor,
        requestKey,
        'SUSPEND',
        'Reason',
      ),
      access.lifecycle(
        tenantId,
        employee.id,
        actor,
        requestKey,
        'SUSPEND',
        'Reason',
      ),
    ]);
    expect(first.id).toBe(second.id);
    await expect(
      access.lifecycle(
        tenantId,
        employee.id,
        actor,
        requestKey,
        'SUSPEND',
        'Changed',
      ),
    ).rejects.toThrow(ConflictException);
    await expect(
      access.lifecycle(tenantId, employee.id, actor, key(), 'RESTORE', 'Other'),
    ).rejects.toThrow(ConflictException);
    await access.process(first.id);
    await access.process(first.id);
    expect(
      (await auth.user.findUniqueOrThrow({ where: { id: user.id } }))
        .sessionVersion,
    ).toBe(1);
  });

  it('reconciles a lost lifecycle reply without advancing the account epoch twice', async () => {
    const user = await activeEmployeeLink();
    const op = await access.lifecycle(
      tenantId,
      employee.id,
      actor,
      key(),
      'SUSPEND',
      'Reason',
    );
    const execute = hrRpc.employeeAccessLifecycle.getMockImplementation();
    let lost = true;
    hrRpc.employeeAccessLifecycle.mockImplementation(
      async (payload: import('@work-phelo/types').EmployeeAccessLifecycle) => {
        const result = await execute(payload);
        if (lost) {
          lost = false;
          throw new Error('lost reply');
        }
        return result;
      },
    );
    await access.process(op.id);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).status,
    ).toBe('RECONCILING');
    await access.process(op.id);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).status,
    ).toBe('COMPLETED');
    expect(
      (await auth.user.findUniqueOrThrow({ where: { id: user.id } }))
        .sessionVersion,
    ).toBe(1);
  });

  it('rejects protected, self, cross-tenant and inactive restoration targets', async () => {
    await expect(
      access.lifecycle(
        tenantId,
        randomUUID(),
        actor,
        key(),
        'SUSPEND',
        'Reason',
      ),
    ).rejects.toThrow(NotFoundException);
    await hr.employee.update({
      where: { id: employee.id },
      data: { userId: actor.id },
    });
    await expect(
      access.lifecycle(
        tenantId,
        employee.id,
        actor,
        key(),
        'SUSPEND',
        'Reason',
      ),
    ).rejects.toThrow(ForbiddenException);
    const otherAdmin = await auth.user.create({
      data: {
        tenantId,
        email: `admin-${randomUUID()}@example.test`,
        firstName: 'Admin',
        lastName: 'Other',
        role: 'TENANT_ADMIN',
        status: 'ACTIVE',
      },
    });
    await hr.employee.update({
      where: { id: employee.id },
      data: { userId: otherAdmin.id },
    });
    const op = await access.lifecycle(
      tenantId,
      employee.id,
      actor,
      key(),
      'SUSPEND',
      'Reason',
    );
    await access.process(op.id);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).lastErrorCode,
    ).toBe('TARGET_INELIGIBLE');
  });

  it('resends an expired legacy invitation durably, acknowledges once and limits repeated generations', async () => {
    const user = await activeEmployeeLink();
    await auth.user.update({
      where: { id: user.id },
      data: {
        status: 'PENDING_VERIFICATION',
        inviteToken: randomUUID(),
        inviteExpiresAt: new Date(0),
        emailVerifiedAt: null,
      },
    });
    expect((await access.read(tenantId, employee.id, actor)).status).toBe(
      'INVITE_EXPIRED',
    );
    const op = await access.lifecycle(
      tenantId,
      employee.id,
      actor,
      key(),
      'RESEND',
      'Requested again',
    );
    await access.process(op.id);
    expect(email.sendEmployeeInviteEmail).not.toHaveBeenCalled();
    const token = (
      await auth.user.findUniqueOrThrow({ where: { id: user.id } })
    ).inviteToken;
    await lifecycle.publishOne(op.id);
    await access.process(op.id);
    await lifecycle.publishOne(op.id);
    expect(email.sendEmployeeInviteEmail).toHaveBeenCalledTimes(1);
    expect(
      (await auth.user.findUniqueOrThrow({ where: { id: user.id } }))
        .inviteToken,
    ).toBe(token);
    expect((await access.read(tenantId, employee.id, actor)).status).toBe(
      'INVITED',
    );
    const duplicate = await access.lifecycle(
      tenantId,
      employee.id,
      actor,
      key(),
      'RESEND',
      'Too soon',
    );
    await access.process(duplicate.id);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: duplicate.id },
        })
      ).lastErrorCode,
    ).toBe('INVITATION_RESEND_COOLDOWN');
    expect((await access.read(tenantId, employee.id, actor)).status).toBe(
      'INVITED',
    );
    const users = new UsersService(
      auth,
      authRpc,
      { sign: () => randomUUID() },
      {},
      {},
    );
    await users.acceptInvite({
      inviteToken: token,
      password: 'LocalIntegrationPassword123!',
    });
    expect(
      (await auth.user.findUniqueOrThrow({ where: { id: user.id } })).status,
    ).toBe('ACTIVE');
  });

  it('filters NONE before pagination/counts and fails explicitly for Auth-owned filters', async () => {
    const requested = await hr.employee.create({
      data: {
        ...employee,
        id: randomUUID(),
        employeeNumber: 'EMP-0002',
        email: null,
        normalizedEmail: null,
        emailHash: null,
      },
    });
    await access.grant(
      tenantId,
      requested.id,
      actor,
      key(),
      'other@example.test',
    );
    const first = await employees.findAll(
      tenantId,
      { accessStatus: 'NONE', limit: 1, page: 1 },
      actor,
    );
    expect(first.employees.map((e) => e.id)).toEqual([employee.id]);
    expect(first.meta.total).toBe(1);
    const empty = await employees.findAll(
      tenantId,
      { accessStatus: 'NONE', limit: 1, page: 2 },
      actor,
    );
    expect(empty.employees).toHaveLength(0);
    expect(empty.meta.total).toBe(1);
    hrRpc.employeeAccessSnapshot.mockRejectedValue(
      new Error('Auth unavailable'),
    );
    expect(
      (await employees.findAll(tenantId, { accessStatus: 'NONE' }, actor)).meta
        .total,
    ).toBe(1);
    await activeEmployeeLink();
    await expect(
      employees.findAll(tenantId, { accessStatus: 'ACTIVE' }, actor),
    ).rejects.toThrow('Current Auth access states could not be established');
  });

  it('filters account states, provisioning overlays and missing identities before pagination', async () => {
    await activeEmployeeLink();
    const pending = await hr.employee.create({
      data: {
        ...employee,
        id: randomUUID(),
        employeeNumber: 'FILTER-PENDING',
        email: null,
        normalizedEmail: null,
        emailHash: null,
        userId: null,
      },
    });
    await access.grant(
      tenantId,
      pending.id,
      actor,
      key(),
      'pending-filter@example.test',
    );
    const absent = await hr.employee.create({
      data: {
        ...employee,
        id: randomUUID(),
        employeeNumber: 'FILTER-MISSING',
        email: null,
        normalizedEmail: null,
        emailHash: null,
        userId: randomUUID(),
      },
    });
    const first = await employees.findAll(
      tenantId,
      { accessStatus: 'ACTIVE', limit: 1, page: 1 },
      actor,
    );
    expect(first.employees.map((e) => e.id)).toEqual([employee.id]);
    const empty = await employees.findAll(
      tenantId,
      { accessStatus: 'ACTIVE', limit: 1, page: 2 },
      actor,
    );
    expect(empty.employees).toHaveLength(0);
    expect(empty.meta.total).toBe(1);
    expect(
      (
        await employees.findAll(
          tenantId,
          { accessStatus: 'PROVISIONING' },
          actor,
        )
      ).employees.map((e) => e.id),
    ).toEqual([pending.id]);
    expect(
      (
        await employees.findAll(
          tenantId,
          { accessStatus: 'INCONSISTENT' },
          actor,
        )
      ).employees.map((e) => e.id),
    ).toEqual([absent.id]);
    const op = await access.lifecycle(
      tenantId,
      employee.id,
      actor,
      key(),
      'SUSPEND',
      'Filter test',
    );
    await access.process(op.id);
    expect(
      (await employees.findAll(tenantId, { accessStatus: 'SUSPENDED' }, actor))
        .meta.total,
    ).toBe(1);
    expect(
      (await employees.findAll(tenantId, { accessStatus: 'ACTIVE' }, actor))
        .meta.total,
    ).toBe(0);
    await expect(
      employees.findAll(
        tenantId,
        { accessStatus: 'ACTIVE' },
        { ...actor, tenantId: 'foreign' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('bounds live filtering to 1000 candidates with one Auth snapshot per request', async () => {
    const users = Array.from({ length: 1000 }, () => ({
      id: randomUUID(),
      tenantId,
      email: `load-${key()}@example.test`,
      firstName: 'Load',
      lastName: 'Test',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    }));
    await auth.user.createMany({ data: users });
    await hr.employee.createMany({
      data: users.map((u, i) => ({
        ...employee,
        id: randomUUID(),
        employeeNumber: `LOAD-${i}`,
        email: null,
        normalizedEmail: null,
        emailHash: null,
        userId: u.id,
        jobTitle: 'Bounded Load',
      })),
    });
    const start = Date.now();
    const first = await employees.findAll(
      tenantId,
      { accessStatus: 'ACTIVE', search: 'Bounded Load', page: 1, limit: 100 },
      actor,
    );
    const second = await employees.findAll(
      tenantId,
      { accessStatus: 'ACTIVE', search: 'Bounded Load', page: 2, limit: 100 },
      actor,
    );
    expect(first.meta.total).toBe(1000);
    expect(second.meta.total).toBe(1000);
    expect(
      new Set([...first.employees, ...second.employees].map((e) => e.id)).size,
    ).toBe(200);
    expect(hrRpc.employeeAccessSnapshot).toHaveBeenCalledTimes(2);
    console.info(
      `Employee access load: 1000 candidates, two pages, ${Date.now() - start}ms`,
    );
    await hr.employee.create({
      data: {
        ...employee,
        id: randomUUID(),
        employeeNumber: 'LOAD-OVERFLOW',
        email: null,
        normalizedEmail: null,
        emailHash: null,
        jobTitle: 'Bounded Load',
      },
    });
    hrRpc.employeeAccessSnapshot.mockClear();
    await expect(
      employees.findAll(
        tenantId,
        { accessStatus: 'ACTIVE', search: 'Bounded Load' },
        actor,
      ),
    ).rejects.toThrow('Narrow the employee search');
    expect(hrRpc.employeeAccessSnapshot).not.toHaveBeenCalled();
  });

  it('recovers a paused timeout with the original ID and fences concurrent operator requests', async () => {
    const op = await grant();
    const execute = hrRpc.employeeAccessCommand.getMockImplementation();
    hrRpc.employeeAccessCommand.mockRejectedValue(new Error('broker down'));
    await hr.employeeAccessOperation.update({
      where: { id: op.id },
      data: { attemptCount: 7 },
    });
    await access.process(op.id);
    hrRpc.employeeAccessCommand.mockImplementation(execute);
    const requestKey = key();
    const results = await Promise.allSettled([
      recovery.reconcile(
        tenantId,
        employee.id,
        op.id,
        actor,
        requestKey,
        'Broker repaired',
      ),
      recovery.reconcile(
        tenantId,
        employee.id,
        op.id,
        actor,
        requestKey,
        'Broker repaired',
      ),
    ]);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    await expect(
      recovery.reconcile(
        tenantId,
        employee.id,
        op.id,
        actor,
        requestKey,
        'Broker repaired',
      ),
    ).resolves.toMatchObject({ outcome: 'REQUEUE' });
    expect(
      await hr.employeeAccessRecoveryRequest.count({
        where: { tenantId, operationId: op.id },
      }),
    ).toBe(1);
    await finish(op);
    expect(
      await auth.user.count({ where: { tenantId, role: 'EMPLOYEE' } }),
    ).toBe(1);
    await expect(
      recovery.reconcile(
        tenantId,
        employee.id,
        op.id,
        actor,
        key(),
        'Restart terminal',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('recovers notification retries without rotating tokens or duplicating receipts', async () => {
    const op = await grant();
    await access.process(op.id);
    email.sendEmployeeInviteEmail.mockRejectedValueOnce(
      new Error('provider down'),
    );
    await commands.publishOne(op.id);
    await auth.employeeAccessCommand.update({
      where: { id: op.id },
      data: {
        status: 'PAUSED',
        attemptCount: 8,
        lastErrorCode: 'NOTIFICATION_RETRY_EXHAUSTED',
      },
    });
    await hr.employeeAccessOperation.update({
      where: { id: op.id },
      data: { status: 'PAUSED', nextAttemptAt: null },
    });
    const userId = (
      await hr.employee.findUniqueOrThrow({ where: { id: employee.id } })
    ).userId;
    const token = (await auth.user.findUniqueOrThrow({ where: { id: userId } }))
      .inviteToken;
    await expect(
      recovery.reconcile(
        tenantId,
        employee.id,
        op.id,
        actor,
        key(),
        'Provider recovered',
      ),
    ).resolves.toMatchObject({ outcome: 'REQUEUE' });
    await commands.publishOne(op.id);
    await access.process(op.id);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).status,
    ).toBe('COMPLETED');
    expect(
      (await auth.user.findUniqueOrThrow({ where: { id: userId } }))
        .inviteToken,
    ).toBe(token);
    expect(
      await notify.employeeInviteReceipt.count({ where: { id: op.id } }),
    ).toBe(1);
  });

  it('refuses ambiguous delivery recovery, active leases and cross-tenant operation IDs', async () => {
    const op = await grant();
    await access.process(op.id);
    await commands.publishOne(op.id);
    await notify.employeeInviteReceipt.update({
      where: { id: op.id },
      data: { status: 'UNKNOWN' },
    });
    await auth.employeeAccessCommand.update({
      where: { id: op.id },
      data: { status: 'PAUSED', lastErrorCode: 'NOTIFICATION_UNKNOWN' },
    });
    await hr.employeeAccessOperation.update({
      where: { id: op.id },
      data: { status: 'PAUSED', leaseUntil: new Date(Date.now() + 120000) },
    });
    await expect(
      recovery.reconcile(tenantId, employee.id, op.id, actor, key(), 'Review'),
    ).rejects.toThrow('active lease');
    await hr.employeeAccessOperation.update({
      where: { id: op.id },
      data: { leaseUntil: new Date(0) },
    });
    await expect(
      recovery.reconcile(tenantId, employee.id, op.id, actor, key(), 'Review'),
    ).resolves.toMatchObject({
      outcome: 'BLOCKED',
      errorCode: 'DELIVERY_REVIEW_REQUIRED',
    });
    await expect(
      recovery.reconcile(
        'foreign',
        employee.id,
        op.id,
        { ...actor, tenantId: 'foreign' },
        key(),
        'Foreign',
      ),
    ).rejects.toThrow(NotFoundException);
    const rows = await recovery.list(actor, 1, 'PAUSED');
    expect(rows.items).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain('inviteToken');
    expect(email.sendEmployeeInviteEmail).toHaveBeenCalledTimes(1);
  });

  it('offboarding revokes access and prevents generic activation while preserving permissions', async () => {
    const user = await activeEmployeeLink();
    await hr.employee.update({
      where: { id: employee.id },
      data: { employmentStatus: 'OFFBOARDED', offboardedAt: new Date() },
    });
    const users = new UsersService(auth, authRpc, {}, {}, {});
    await auth.user.update({
      where: { id: user.id },
      data: { status: 'INACTIVE' },
    });
    await users.deactivateEmployeeAccess(tenantId, user.id);
    expect(
      (await auth.user.findUniqueOrThrow({ where: { id: user.id } }))
        .accessSuspensionReason,
    ).toBe('EMPLOYEE_OFFBOARDED');
    expect(
      (await auth.user.findUniqueOrThrow({ where: { id: user.id } })).status,
    ).toBe('INACTIVE');
    await expect(
      users.update(tenantId, user.id, { status: 'ACTIVE' }, actor),
    ).rejects.toThrow(ForbiddenException);
    expect(
      await auth.userPermissionSet.count({ where: { userId: user.id } }),
    ).toBe(1);
  });

  it('filters invitation, failed provisioning and inactive states consistently with detail reads', async () => {
    const user = await activeEmployeeLink();
    for (const [status, expected] of [
      ['INACTIVE', 'INACTIVE'],
      ['PENDING_VERIFICATION', 'INVITED'],
    ] as const) {
      await auth.user.update({
        where: { id: user.id },
        data: {
          status,
          inviteToken: key(),
          inviteExpiresAt: new Date(Date.now() + 3600000),
        },
      });
      expect(
        (await employees.findAll(tenantId, { accessStatus: expected }, actor))
          .meta.total,
      ).toBe(1);
      expect((await access.read(tenantId, employee.id, actor)).status).toBe(
        expected,
      );
    }
    await auth.user.update({
      where: { id: user.id },
      data: { inviteExpiresAt: new Date(0) },
    });
    expect(
      (
        await employees.findAll(
          tenantId,
          { accessStatus: 'INVITE_EXPIRED' },
          actor,
        )
      ).meta.total,
    ).toBe(1);
    const unlinked = await hr.employee.create({
      data: {
        ...employee,
        id: key(),
        employeeNumber: 'FAILED-FILTER',
        email: null,
        normalizedEmail: null,
        emailHash: null,
        userId: null,
      },
    });
    const op = await access.grant(
      tenantId,
      unlinked.id,
      actor,
      key(),
      'failed-filter@example.test',
    );
    await hr.employeeAccessOperation.update({
      where: { id: op.id },
      data: { status: 'FAILED' },
    });
    expect(
      (
        await employees.findAll(
          tenantId,
          { accessStatus: 'PROVISIONING_FAILED' },
          actor,
        )
      ).employees.map((e) => e.id),
    ).toEqual([unlinked.id]);
  });

  it('uses a single captured Auth state per page without using it for future authorization', async () => {
    const user = await activeEmployeeLink();
    const snapshot = hrRpc.employeeAccessSnapshot.getMockImplementation();
    hrRpc.employeeAccessSnapshot.mockImplementationOnce(
      async (
        input: import('@work-phelo/types').EmployeeAccessSnapshotRequest,
      ) => {
        const result = await snapshot(input);
        await auth.user.update({
          where: { id: user.id },
          data: { status: 'INACTIVE' },
        });
        return result;
      },
    );
    expect(
      (await employees.findAll(tenantId, { accessStatus: 'ACTIVE' }, actor))
        .meta.total,
    ).toBe(1);
    expect(
      (await employees.findAll(tenantId, { accessStatus: 'ACTIVE' }, actor))
        .meta.total,
    ).toBe(0);
    await expect(
      new JwtStrategy(auth, { getOrThrow: () => 'test-secret' }).validate({
        sub: user.id,
        tenantId,
      }),
    ).rejects.toThrow();
  });

  it('replays an ambiguous recovery RPC outcome without changing the operation ID or duplicating requests', async () => {
    const op = await grant();
    const requestKey = key();
    const send = hrRpc.recoverEmployeeAccess.getMockImplementation();
    hrRpc.recoverEmployeeAccess.mockImplementationOnce(
      async (payload: import('@work-phelo/types').EmployeeAccessRecovery) => {
        await send(payload);
        throw new Error('response lost');
      },
    );
    await expect(
      recovery.reconcile(
        tenantId,
        employee.id,
        op.id,
        actor,
        requestKey,
        'Retry dependency',
      ),
    ).resolves.toMatchObject({ outcome: 'PENDING' });
    await expect(
      recovery.reconcile(
        tenantId,
        employee.id,
        op.id,
        actor,
        requestKey,
        'Retry dependency',
      ),
    ).resolves.toMatchObject({ outcome: 'REQUEUE' });
    expect(
      await auth.employeeAccessRecoveryReceipt.count({
        where: { tenantId, operationId: op.id },
      }),
    ).toBe(1);
    await expect(
      recovery.reconcile(
        tenantId,
        employee.id,
        op.id,
        actor,
        requestKey,
        'Changed reason',
      ),
    ).rejects.toThrow(ConflictException);
    await finish(op);
    expect(
      await auth.user.count({ where: { tenantId, role: 'EMPLOYEE' } }),
    ).toBe(1);
  });

  it('does not disable an account promoted to administrator while HR offboarding is verified', async () => {
    const user = await activeEmployeeLink();
    await hr.employee.update({
      where: { id: employee.id },
      data: { employmentStatus: 'OFFBOARDED' },
    });
    authRpc.verifyEmployeeOffboarded.mockImplementationOnce(async () => {
      await auth.user.update({
        where: { id: user.id },
        data: { role: 'TENANT_ADMIN' },
      });
      return { offboarded: true };
    });
    await expect(
      new UsersService(auth, authRpc, {}, {}, {}).deactivateEmployeeAccess(
        tenantId,
        user.id,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(
      (await auth.user.findUniqueOrThrow({ where: { id: user.id } })).status,
    ).toBe('ACTIVE');
  });

  it('settles an accepted invitation after a lost acknowledgment without resending to an active identity', async () => {
    const op = await grant();
    await access.process(op.id);
    const send = authRpc.sendEmployeeAccessInvite.getMockImplementation();
    authRpc.sendEmployeeAccessInvite.mockImplementationOnce(
      async (payload: import('@work-phelo/types').EmployeeAccessInvite) => {
        await send(payload);
        throw new Error('acknowledgment lost');
      },
    );
    await commands.publishOne(op.id);
    const userId = (
      await hr.employee.findUniqueOrThrow({ where: { id: employee.id } })
    ).userId;
    const user = await auth.user.findUniqueOrThrow({ where: { id: userId } });
    await new UsersService(
      auth,
      authRpc,
      { sign: () => key() },
      {},
      {},
    ).acceptInvite({
      inviteToken: user.inviteToken,
      password: 'LocalOnlyTestPassword123!',
    });
    await commands.publishOne(op.id);
    await access.process(op.id);
    expect(
      (
        await auth.employeeAccessCommand.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).status,
    ).toBe('EXPIRED');
    await expect(
      recovery.reconcile(
        tenantId,
        employee.id,
        op.id,
        actor,
        key(),
        'Reconcile accepted invitation',
      ),
    ).resolves.toMatchObject({ outcome: 'REQUEUE' });
    await access.process(op.id);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).status,
    ).toBe('COMPLETED');
    expect(email.sendEmployeeInviteEmail).toHaveBeenCalledTimes(1);
    expect(
      (await auth.user.findUniqueOrThrow({ where: { id: userId } })).status,
    ).toBe('ACTIVE');
  });

  it('allows a non-admin operator only while its database-backed employee and user permissions remain active', async () => {
    await auth.user.update({
      where: { id: actor.id },
      data: { role: 'EMPLOYEE' },
    });
    const userResource = await auth.resource.upsert({
      where: { name: 'users' },
      update: {},
      create: { name: 'users', module: 'AUTH' },
    });
    const employeeResource = await auth.resource.upsert({
      where: { name: 'employees' },
      update: {},
      create: { name: 'employees', module: 'HR' },
    });
    await auth.userPermission.create({
      data: {
        tenantId,
        userId: actor.id,
        resourceId: userResource.id,
        action: 'CREATE',
        grantedBy: actor.id,
      },
    });
    await auth.userPermission.create({
      data: {
        tenantId,
        userId: actor.id,
        resourceId: employeeResource.id,
        action: 'EDIT',
        grantedBy: actor.id,
      },
    });
    actor = {
      ...actor,
      role: 'EMPLOYEE',
      permissions: ['users:CREATE', 'employees:EDIT'],
    };
    const op = await grant();
    await access.process(op.id);
    expect(
      (
        await hr.employeeAccessOperation.findUniqueOrThrow({
          where: { id: op.id },
        })
      ).status,
    ).toBe('LINKED');
    await auth.userPermission.updateMany({
      where: { tenantId, userId: actor.id, resourceId: userResource.id },
      data: { isActive: false },
    });
    await commands.publishOne(op.id);
    expect(
      (await auth.employeeAccessCommand.findUnique({ where: { id: op.id } }))
        .lastErrorCode,
    ).toBe('ACTOR_PERMISSION_REVOKED');
    expect(email.sendEmployeeInviteEmail).not.toHaveBeenCalled();
  });
});
