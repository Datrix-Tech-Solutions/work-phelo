import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { TenantsController } from './tenants.controller';

function makeController() {
  const lifecycle = {};
  const config = {};
  const admin = {};
  const branding = {
    findByTenantId: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
    findPublicBySlug: jest.fn().mockResolvedValue({ tenantSlug: 'acme-ghana' }),
    update: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
  };

  return {
    branding,
    controller: new TenantsController(
      lifecycle as never,
      config as never,
      admin as never,
      branding as never,
    ),
  };
}

function requestUser(overrides: Partial<RequestUser> = {}) {
  return {
    id: 'user-1',
    tenantId: 'tenant-1',
    role: 'TENANT_ADMIN',
    email: 'admin@acmeghana.com',
    permissions: [],
    ...overrides,
  } as RequestUser;
}

describe('TenantsController branding access', () => {
  it('allows tenant admin to read own tenant branding', async () => {
    const { branding, controller } = makeController();
    const req = { user: requestUser() };

    await controller.getBranding('tenant-1', req as never);

    expect(branding.findByTenantId).toHaveBeenCalledWith('tenant-1');
  });

  it('rejects tenant admin reading another tenant branding', () => {
    const { controller } = makeController();
    const req = { user: requestUser() };

    expect(() => controller.getBranding('tenant-2', req as never)).toThrow(
      ForbiddenException,
    );
  });

  it('allows super admin to update any tenant branding', async () => {
    const { branding, controller } = makeController();
    const req = { user: requestUser({ role: 'SUPER_ADMIN' }) };

    await controller.updateBranding(
      'tenant-2',
      { primaryColor: '#0D2244' },
      req as never,
    );

    expect(branding.update).toHaveBeenCalledWith(
      'tenant-2',
      { primaryColor: '#0D2244' },
      'user-1',
    );
  });

  it('delegates public slug branding lookup without auth metadata', async () => {
    const { branding, controller } = makeController();

    await controller.getPublicBrandingBySlug('acme-ghana');

    expect(branding.findPublicBySlug).toHaveBeenCalledWith('acme-ghana');
  });
});
