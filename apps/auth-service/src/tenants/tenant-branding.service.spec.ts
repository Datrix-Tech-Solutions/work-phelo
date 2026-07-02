import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  TenantBrandingService,
  WORKPHELO_BRANDING_DEFAULTS,
} from './tenant-branding.service';

const TENANT = {
  id: 'tenant-1',
  slug: 'acme-ghana',
  name: 'Acme Ghana Ltd',
  logoUrl: null,
};

const BRANDING = {
  logoObjectKey: 'tenant-branding/tenant-1/logo/v1/logo.png',
  logoDisplayUrl: 'https://cdn.example.com/legacy-logo.png',
  faviconObjectKey: null,
  faviconDisplayUrl: 'https://cdn.example.com/favicon.ico',
  primaryColor: '#111111',
  secondaryColor: '#222222',
  accentColor: '#333333',
  sidebarColor: '#444444',
  emailHeaderColor: '#555555',
  documentHeaderColor: '#666666',
  updatedByUserId: 'user-1',
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-02T00:00:00.000Z'),
};

function makePrisma() {
  return {
    tenant: {
      findUnique: jest.fn(),
    },
    tenantBranding: {
      upsert: jest.fn(),
    },
  };
}

function makeService(prisma = makePrisma()) {
  return {
    prisma,
    service: new TenantBrandingService(prisma as unknown as PrismaService),
  };
}

describe('TenantBrandingService', () => {
  it('returns WorkPhelo defaults when no branding exists', async () => {
    const { prisma, service } = makeService();
    prisma.tenant.findUnique.mockResolvedValue({ ...TENANT, branding: null });

    const result = await service.findByTenantId('tenant-1');

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      include: { branding: true },
    });
    expect(result).toMatchObject({
      tenantId: 'tenant-1',
      tenantSlug: 'acme-ghana',
      tenantName: 'Acme Ghana Ltd',
      logoObjectKey: null,
      logoDisplayUrl: null,
      ...WORKPHELO_BRANDING_DEFAULTS,
      defaultsApplied: true,
    });
  });

  it('updates branding and clears display URLs when object keys are present', async () => {
    const { prisma, service } = makeService();
    prisma.tenant.findUnique
      .mockResolvedValueOnce({ ...TENANT, branding: null })
      .mockResolvedValueOnce({
        ...TENANT,
        branding: {
          ...BRANDING,
          logoDisplayUrl: null,
          faviconDisplayUrl: null,
        },
      });

    const result = await service.update(
      'tenant-1',
      {
        logoObjectKey: BRANDING.logoObjectKey,
        faviconObjectKey: 'tenant-branding/tenant-1/favicon/v1/favicon.ico',
        logoDisplayUrl: 'https://cdn.example.com/should-not-be-source.png',
        primaryColor: '#123456',
      },
      'user-1',
    );

    expect(prisma.tenantBranding.upsert).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      create: expect.objectContaining({
        tenantId: 'tenant-1',
        logoObjectKey: BRANDING.logoObjectKey,
        logoDisplayUrl: null,
        faviconObjectKey: 'tenant-branding/tenant-1/favicon/v1/favicon.ico',
        faviconDisplayUrl: null,
        primaryColor: '#123456',
        updatedByUserId: 'user-1',
      }),
      update: expect.objectContaining({
        logoObjectKey: BRANDING.logoObjectKey,
        logoDisplayUrl: null,
        faviconObjectKey: 'tenant-branding/tenant-1/favicon/v1/favicon.ico',
        faviconDisplayUrl: null,
        primaryColor: '#123456',
        updatedByUserId: 'user-1',
      }),
    });
    expect(result.logoDisplayUrl).toBeNull();
  });

  it('rejects invalid hex colors', async () => {
    const { service } = makeService();

    await expect(
      service.update('tenant-1', { primaryColor: 'blue' }, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when tenant is missing', async () => {
    const { prisma, service } = makeService();
    prisma.tenant.findUnique.mockResolvedValue(null);

    await expect(service.findByTenantId('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('public slug lookup returns safe branding without object keys or audit metadata', async () => {
    const { prisma, service } = makeService();
    prisma.tenant.findUnique.mockResolvedValue({
      ...TENANT,
      branding: BRANDING,
    });

    const result = await service.findPublicBySlug('acme-ghana');

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { slug: 'acme-ghana' },
      include: { branding: true },
    });
    expect(result).toEqual({
      tenantSlug: 'acme-ghana',
      tenantName: 'Acme Ghana Ltd',
      logoDisplayUrl: null,
      faviconDisplayUrl: 'https://cdn.example.com/favicon.ico',
      primaryColor: '#111111',
      secondaryColor: '#222222',
      accentColor: '#333333',
      sidebarColor: '#444444',
      emailHeaderColor: '#555555',
      documentHeaderColor: '#666666',
      defaultsApplied: false,
    });
    expect(result).not.toHaveProperty('tenantId');
    expect(result).not.toHaveProperty('logoObjectKey');
    expect(result).not.toHaveProperty('updatedByUserId');
  });

  it('uses the legacy tenant logo while canonical branding has no logo', async () => {
    const { prisma, service } = makeService();
    prisma.tenant.findUnique.mockResolvedValue({
      ...TENANT,
      logoUrl: 'https://app.workphelo.com/iriskre.png',
      branding: { ...BRANDING, logoObjectKey: null, logoDisplayUrl: null },
    });

    const result = await service.findPublicBySlug('acme-ghana');

    expect(result.logoDisplayUrl).toBe('https://app.workphelo.com/iriskre.png');
  });
});
