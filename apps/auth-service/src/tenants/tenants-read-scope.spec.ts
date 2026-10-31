import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { Server } from 'http';
import request from 'supertest';
import { AuditService } from '../audit/audit.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { PrismaService } from '../prisma/prisma.service';
import { TenantAdminService } from './tenant-admin.service';
import { TenantBrandingService } from './tenant-branding.service';
import { TenantConfigService } from './tenant-config.service';
import { TenantLifecycleService } from './tenant-lifecycle.service';
import { TenantsController } from './tenants.controller';

const SECRET = 'tenant-read-scope-unit-test-secret';
const tenant = (id: string) => ({
  id,
  name: `Company ${id}`,
  slug: id,
  email: `${id}@example.test`,
  status: 'ACTIVE',
  moduleConfig: { hr: true },
  featureConfig: { hr: { payroll: true } },
  integrationConfig: {},
  labelConfig: {},
  _count: { users: 2 },
});
const user = (role = 'EMPLOYEE') => ({
  id: 'user-a',
  email: 'person@example.test',
  firstName: 'Ama',
  avatarUrl: null,
  role,
  status: 'ACTIVE',
  tenantId: 'tenant-a',
  tenant: tenant('tenant-a'),
});

describe('GET /tenants/:id current caller scope', () => {
  let app: INestApplication;
  let storedUser: ReturnType<typeof user> | null;
  const controllerPathReached = jest.fn();
  const records = new Map([
    ['tenant-a', tenant('tenant-a')],
    ['tenant-b', tenant('tenant-b')],
  ]);
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === 'user-a' ? storedUser : null),
      ),
    },
    tenant: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(records.get(where.id) ?? null),
      ),
    },
    userPermission: { findMany: jest.fn().mockResolvedValue([]) },
    userPermissionSet: { findMany: jest.fn().mockResolvedValue([]) },
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [TenantsController],
      providers: [
        JwtStrategy,
        TenantLifecycleService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { getOrThrow: () => SECRET } },
        { provide: RabbitMQPublisher, useValue: {} },
        { provide: AuditService, useValue: {} },
        { provide: TenantConfigService, useValue: {} },
        { provide: TenantAdminService, useValue: {} },
        { provide: TenantBrandingService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    // Interceptors run after guards, without replacing the real JWT guard or handler.
    app.useGlobalInterceptors({
      intercept: (_context, next) => {
        controllerPathReached();
        return next.handle();
      },
    });
    await app.init();
  });

  beforeEach(() => {
    storedUser = user();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  const read = (id: string, claims: Record<string, string> = {}) => {
    const token = jwt.sign(
      { sub: 'user-a', tenantId: 'tenant-a', role: 'EMPLOYEE', ...claims },
      SECRET,
      { expiresIn: '1m' },
    );
    return request(app.getHttpServer() as Server)
      .get(`/tenants/${id}`)
      .set('Authorization', `Bearer ${token}`);
  };

  it.each(['TENANT_ADMIN', 'EMPLOYEE'])(
    'preserves the own-tenant response for %s',
    async (role) => {
      storedUser = user(role);
      const response = await read('tenant-a').expect(200);
      expect(response.body).toEqual(records.get('tenant-a'));
      expect(controllerPathReached).toHaveBeenCalledTimes(1);
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-a' },
        include: { _count: { select: { users: true } } },
      });
    },
  );

  it.each(['TENANT_ADMIN', 'EMPLOYEE'])(
    'returns identical non-disclosing 404s without target lookup for %s',
    async (role) => {
      storedUser = user(role);
      const existing = await read('tenant-b').expect(404);
      const missing = await read('unknown-tenant').expect(404);
      expect(existing.body).toEqual(missing.body);
      expect(existing.body).toMatchObject({ message: 'Tenant not found' });
      expect(controllerPathReached).toHaveBeenCalledTimes(2);
      expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    },
  );

  it('preserves current SUPER_ADMIN cross-tenant reads even with an old employee token role', async () => {
    storedUser = user('SUPER_ADMIN');
    const response = await read('tenant-b').expect(200);
    expect(response.body).toEqual(records.get('tenant-b'));
    expect(controllerPathReached).toHaveBeenCalledTimes(1);
  });

  it('uses existing service not-found behavior for a platform request for a nonexistent tenant', async () => {
    storedUser = user('SUPER_ADMIN');
    await read('unknown-tenant').expect(404, {
      message: 'Tenant not found',
      error: 'Not Found',
      statusCode: 404,
    });
    expect(prisma.tenant.findUnique).toHaveBeenCalledTimes(1);
  });

  it('preserves service not-found behavior when the own-tenant target disappears after authentication', async () => {
    storedUser = { ...user(), tenantId: 'gone', tenant: tenant('gone') };
    await read('gone', { tenantId: 'gone' }).expect(404);
    expect(controllerPathReached).toHaveBeenCalledTimes(1);
    expect(prisma.tenant.findUnique).toHaveBeenCalledTimes(1);
  });

  it('does not trust a stale admin role in a valid tenant-bound token', async () => {
    await read('tenant-b', {
      role: 'SUPER_ADMIN',
    }).expect(404);
    await read('tenant-a', {
      role: 'SUPER_ADMIN',
    }).expect(200);
    expect(controllerPathReached).toHaveBeenCalledTimes(2);
    expect(prisma.tenant.findUnique).toHaveBeenCalledTimes(1);
  });

  it('rejects a mismatched JWT tenant before the controller regardless of the target path', async () => {
    const claims = { tenantId: 'tenant-b', role: 'SUPER_ADMIN' };
    await read('tenant-b', claims).expect(401);
    await read('tenant-a', claims).expect(401);
    expect(controllerPathReached).not.toHaveBeenCalled();
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('denies a previously linked tenant after the user has moved tenants', async () => {
    storedUser = {
      ...user(),
      tenantId: 'tenant-b',
      tenant: tenant('tenant-b'),
    };
    // The previous tenant's token is invalid, even when targeting the new tenant.
    await read('tenant-a').expect(401);
    await read('tenant-b').expect(401);
    expect(controllerPathReached).not.toHaveBeenCalled();
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();

    // A fresh tenant-bound session reaches the resource-scope policy normally.
    await read('tenant-a', { tenantId: 'tenant-b' }).expect(404);
    await read('tenant-b', { tenantId: 'tenant-b' }).expect(200);
    expect(controllerPathReached).toHaveBeenCalledTimes(2);
    expect(prisma.tenant.findUnique).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid current tenant linkage rather than trusting the token', async () => {
    storedUser = { ...user(), tenantId: '' };
    await read('tenant-a').expect(401);
    expect(controllerPathReached).not.toHaveBeenCalled();
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it.each(['missing-user', 'inactive-user', 'inactive-tenant'])(
    'preserves JWT strategy rejection for %s',
    async (state) => {
      if (state === 'missing-user') storedUser = null;
      if (state === 'inactive-user')
        storedUser = { ...user(), status: 'DISABLED' };
      if (state === 'inactive-tenant') {
        storedUser = {
          ...user(),
          tenant: { ...tenant('tenant-a'), status: 'SUSPENDED' },
        };
      }
      await read('tenant-a').expect(401);
      expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    },
  );

  it('ignores spoofed tenant/user/role headers', async () => {
    await read('tenant-b')
      .set('x-tenant-id', 'tenant-b')
      .set('x-user-role', 'SUPER_ADMIN')
      .set('x-user-id', 'another-user')
      .expect(404);
    await read('tenant-a').set('x-tenant-id', 'tenant-b').expect(200);
    expect(prisma.tenant.findUnique).toHaveBeenCalledTimes(1);
  });

  it('rejects missing or invalid JWTs before reading the tenant', async () => {
    await request(app.getHttpServer() as Server)
      .get('/tenants/tenant-a')
      .expect(401);
    await request(app.getHttpServer() as Server)
      .get('/tenants/tenant-a')
      .set(
        'Authorization',
        `Bearer ${jwt.sign({ sub: 'user-a' }, 'wrong-secret')}`,
      )
      .expect(401);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });
});
