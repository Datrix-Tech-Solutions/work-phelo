import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InternalServiceClientError } from '@work-phelo/internal-auth';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { RequestUser } from '@work-phelo/types';
import { MODULE_KEY } from '../auth/guards/module.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { TenantMarketingEnabledGuard } from '../auth/guards/tenant-marketing-enabled.guard';
import { PlatformSmsController } from './platform-sms.controller';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ID = '22222222-2222-4222-8222-222222222222';
const admin = {
  id: 'platform-1',
  tenantId: 'platform-tenant',
  role: 'SUPER_ADMIN',
} as RequestUser;
const request = { user: admin } as never;

const contextFor = (user?: Partial<RequestUser>) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('PlatformSmsController', () => {
  const senders = {
    list: jest.fn(),
    createApproved: jest.fn(),
    update: jest.fn(),
    archive: jest.fn(),
    setDefault: jest.fn(),
  };
  const wallet = {
    getBalance: jest.fn(),
    listLedger: jest.fn(),
    grantCredits: jest.fn(),
  };
  const controller = new PlatformSmsController(
    senders as never,
    wallet as never,
  );

  beforeEach(() => jest.resetAllMocks());

  it('is guarded by authentication and the platform admin check, not the module guard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PlatformSmsController)).toEqual(
      [JwtAuthGuard, SuperAdminGuard, TenantMarketingEnabledGuard],
    );
    expect(Reflect.getMetadata(MODULE_KEY, PlatformSmsController)).toBe(
      undefined,
    );
  });

  it('lists and reads the tenant named in the path', async () => {
    await controller.listSenders(TENANT, {});
    await controller.getBalance(TENANT);
    await controller.listLedger(TENANT, { page: 2 });

    expect(senders.list).toHaveBeenCalledWith(TENANT, {});
    expect(wallet.getBalance).toHaveBeenCalledWith(TENANT);
    expect(wallet.listLedger).toHaveBeenCalledWith(TENANT, { page: 2 });
  });

  it('creates approved sender identities in the path tenant, as the platform admin', async () => {
    await controller.createSender(TENANT, { senderId: 'ACME' }, request);

    expect(senders.createApproved).toHaveBeenCalledWith(TENANT, 'platform-1', {
      senderId: 'ACME',
    });
  });

  it.each([
    [
      'update',
      () => controller.updateSender(TENANT, ID, { displayName: 'x' }, request),
      senders.update,
    ],
    [
      'archive',
      () => controller.archiveSender(TENANT, ID, request),
      senders.archive,
    ],
    [
      'setDefault',
      () => controller.setDefaultSender(TENANT, ID, request),
      senders.setDefault,
    ],
  ])(
    'acts inside the path tenant, keeping the admin identity, for %s',
    async (_name, call, mock) => {
      await call();

      expect(mock).toHaveBeenCalledWith(
        { ...admin, tenantId: TENANT },
        ID,
        ...(mock === senders.update ? [{ displayName: 'x' }] : []),
      );
    },
  );

  it('grants credits to the path tenant', async () => {
    await controller.grant(TENANT, { credits: 50 }, request);

    expect(wallet.grantCredits).toHaveBeenCalledWith(
      { ...admin, tenantId: TENANT },
      { credits: 50 },
    );
  });
});

describe('SuperAdminGuard', () => {
  const guard = new SuperAdminGuard();

  it('lets platform administrators through', () => {
    expect(guard.canActivate(contextFor({ role: 'SUPER_ADMIN' }))).toBe(true);
  });

  it.each([['TENANT_ADMIN'], ['EMPLOYEE'], [undefined]])(
    'refuses %s',
    (role) => {
      expect(() =>
        guard.canActivate(contextFor(role ? { role } : undefined)),
      ).toThrow(ForbiddenException);
    },
  );
});

describe('TenantMarketingEnabledGuard', () => {
  const tenants = { get: jest.fn() };
  const guard = new TenantMarketingEnabledGuard(tenants as never);
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ params: { tenantId: TENANT } }),
    }),
  } as unknown as ExecutionContext;

  beforeEach(() => jest.resetAllMocks());

  it('lets the request through when the tenant has Marketing enabled', async () => {
    tenants.get.mockResolvedValue({ moduleConfig: { marketing: true } });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tenants.get).toHaveBeenCalledWith(TENANT);
  });

  it('refuses a tenant without Marketing', async () => {
    tenants.get.mockResolvedValue({ moduleConfig: { marketing: false } });

    await expect(guard.canActivate(context)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('reports an unknown tenant as not found', async () => {
    tenants.get.mockRejectedValue(
      new InternalServiceClientError('not found', false, 404),
    );

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });

  it('does not let the request through when auth-service cannot answer', async () => {
    tenants.get.mockRejectedValue(
      new InternalServiceClientError('down', true, 503),
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
