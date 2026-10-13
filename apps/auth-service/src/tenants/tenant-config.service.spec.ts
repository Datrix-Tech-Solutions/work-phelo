import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConfigService } from './tenant-config.service';

type MockFn = jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;

function makePrisma() {
  return {
    tenant: {
      findUnique: jest.fn() as MockFn,
      update: jest.fn() as MockFn,
    },
    auditLog: { create: jest.fn() as MockFn },
  };
}

function tenantWith(overrides: Record<string, unknown> = {}) {
  return {
    moduleConfig: { hr: true },
    featureConfig: { hr: { projects: true } },
    labelConfig: {},
    ...overrides,
  };
}

describe('TenantConfigService.updateLabels', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: TenantConfigService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.tenant.update.mockImplementation((args: unknown) =>
      Promise.resolve({
        labelConfig: (args as { data: { labelConfig: unknown } }).data
          .labelConfig,
      }),
    );
    service = new TenantConfigService(prisma as unknown as PrismaService);
  });

  it('saves a trimmed name and writes an audit entry', async () => {
    prisma.tenant.findUnique.mockResolvedValue(tenantWith());

    const result = await service.updateLabels(
      't-1',
      { projects: '  Case  ' },
      'admin-1',
    );

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { labelConfig: { projects: 'Case' } },
    });
    expect(result.labelConfig).toEqual({ projects: 'Case' });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('clears the name when blank so the default applies', async () => {
    prisma.tenant.findUnique.mockResolvedValue(
      tenantWith({ labelConfig: { projects: 'Case' } }),
    );

    await service.updateLabels('t-1', { projects: '   ' }, 'admin-1');

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { labelConfig: {} },
    });
  });

  it('does not write an audit entry when nothing changed', async () => {
    prisma.tenant.findUnique.mockResolvedValue(
      tenantWith({ labelConfig: { projects: 'Case' } }),
    );

    await service.updateLabels('t-1', { projects: 'Case' }, 'admin-1');

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects a feature that cannot be renamed', async () => {
    prisma.tenant.findUnique.mockResolvedValue(tenantWith());

    await expect(
      service.updateLabels('t-1', { payroll: 'Pay' }, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects naming projects before the feature is enabled', async () => {
    prisma.tenant.findUnique.mockResolvedValue(
      tenantWith({ featureConfig: { hr: { projects: false } } }),
    );

    await expect(
      service.updateLabels('t-1', { projects: 'Case' }, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('rejects names that are too long or contain markup', async () => {
    prisma.tenant.findUnique.mockResolvedValue(tenantWith());

    await expect(
      service.updateLabels('t-1', { projects: 'x'.repeat(31) }, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateLabels('t-1', { projects: '<b>Case</b>' }, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when the tenant does not exist', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);

    await expect(
      service.updateLabels('missing', { projects: 'Case' }, 'admin-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
