/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NotFoundException } from '@nestjs/common';
import { MarketingCrmSettingCategory } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProspectingSettingsService } from './prospecting-settings.service';

describe('ProspectingSettingsService product settings', () => {
  const user = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'admin@example.com',
    role: 'EMPLOYEE',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    firstName: 'Ada',
    moduleConfig: {},
    featureConfig: {},
    integrationConfig: {},
    permissions: [],
  };

  const makePrisma = () => ({
    marketingCrmSettingOption: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  });

  let prisma: ReturnType<typeof makePrisma>;
  let service: ProspectingSettingsService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ProspectingSettingsService(
      prisma as unknown as PrismaService,
    );
  });

  it('creates product and service options through the shared settings model', async () => {
    prisma.marketingCrmSettingOption.findFirst.mockResolvedValue(null);
    prisma.marketingCrmSettingOption.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'product-1', ...data }),
    );

    await service.create(user, MarketingCrmSettingCategory.PRODUCT, {
      name: '  Life   Insurance ',
      description: 'Retail cover',
    });

    expect(prisma.marketingCrmSettingOption.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        category: MarketingCrmSettingCategory.PRODUCT,
        name: 'Life Insurance',
        normalizedName: 'life insurance',
        description: 'Retail cover',
        isActive: true,
      }),
    });
  });

  it('lists tenant-scoped non-archived product settings deterministically', async () => {
    prisma.marketingCrmSettingOption.findMany.mockResolvedValue([]);

    await service.list('tenant-1', MarketingCrmSettingCategory.PRODUCT, {
      isActive: true,
    });

    expect(prisma.marketingCrmSettingOption.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        category: MarketingCrmSettingCategory.PRODUCT,
        archivedAt: null,
        isActive: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('does not read product records through a wrong category endpoint', async () => {
    prisma.marketingCrmSettingOption.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne(
        'tenant-1',
        MarketingCrmSettingCategory.SOURCE_TYPE,
        'product-id',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.marketingCrmSettingOption.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'product-id',
        tenantId: 'tenant-1',
        category: MarketingCrmSettingCategory.SOURCE_TYPE,
        archivedAt: null,
      },
    });
  });
});
