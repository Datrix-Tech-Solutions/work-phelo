/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MarketingCrmSettingCategory,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProspectingSettingDto } from './dto/prospecting-setting.dto';
import { ProspectingSettingsService } from './prospecting-settings.service';

describe('ProspectingSettingsService', () => {
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

  it('creates prospecting settings with normalized active duplicate protection', async () => {
    prisma.marketingCrmSettingOption.findFirst.mockResolvedValue(null);
    prisma.marketingCrmSettingOption.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'setting-1', ...data }),
    );

    const result = await service.create(
      user,
      MarketingCrmSettingCategory.SOURCE_TYPE,
      {
        name: '  Partner   Referral ',
        description: 'External partner',
        displayOrder: 2,
      },
    );

    expect(prisma.marketingCrmSettingOption.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        category: MarketingCrmSettingCategory.SOURCE_TYPE,
        normalizedName: 'partner referral',
        archivedAt: null,
      },
      select: { id: true },
    });
    expect(prisma.marketingCrmSettingOption.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        category: MarketingCrmSettingCategory.SOURCE_TYPE,
        name: 'Partner Referral',
        normalizedName: 'partner referral',
        description: 'External partner',
        displayOrder: 2,
        isActive: true,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
      }),
    });
    expect(result.name).toBe('Partner Referral');
  });

  it('lists tenant-scoped non-archived settings with deterministic ordering and active filtering', async () => {
    prisma.marketingCrmSettingOption.findMany.mockResolvedValue([]);

    await service.list('tenant-1', MarketingCrmSettingCategory.DECISION_MAKER, {
      isActive: false,
    });

    expect(prisma.marketingCrmSettingOption.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        category: MarketingCrmSettingCategory.DECISION_MAKER,
        archivedAt: null,
        isActive: false,
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('reads details by tenant and category without leaking cross-tenant records', async () => {
    prisma.marketingCrmSettingOption.findFirst.mockResolvedValue({
      id: 'setting-1',
    });

    await expect(
      service.findOne(
        'tenant-1',
        MarketingCrmSettingCategory.INTERACTION_MEDIUM,
        'setting-1',
      ),
    ).resolves.toEqual({ id: 'setting-1' });

    expect(prisma.marketingCrmSettingOption.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'setting-1',
        tenantId: 'tenant-1',
        category: MarketingCrmSettingCategory.INTERACTION_MEDIUM,
        archivedAt: null,
      },
    });
  });

  it('returns not found for missing, archived, cross-tenant or wrong-category records', async () => {
    prisma.marketingCrmSettingOption.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne(
        'tenant-1',
        MarketingCrmSettingCategory.PROSPECT_BUSINESS_TYPE,
        'wrong-category-id',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates settings only after a scoped category lookup succeeds', async () => {
    prisma.marketingCrmSettingOption.findFirst
      .mockResolvedValueOnce({
        id: 'setting-1',
        tenantId: 'tenant-1',
        category: MarketingCrmSettingCategory.PROSPECT_BUSINESS_TYPE,
        name: 'SME',
        normalizedName: 'sme',
      })
      .mockResolvedValueOnce(null);
    prisma.marketingCrmSettingOption.update.mockResolvedValue({
      id: 'setting-1',
      name: 'Enterprise',
    });

    await service.update(
      user,
      MarketingCrmSettingCategory.PROSPECT_BUSINESS_TYPE,
      'setting-1',
      { name: ' Enterprise ', isActive: false },
    );

    expect(prisma.marketingCrmSettingOption.findFirst).toHaveBeenNthCalledWith(
      1,
      {
        where: {
          id: 'setting-1',
          tenantId: 'tenant-1',
          category: MarketingCrmSettingCategory.PROSPECT_BUSINESS_TYPE,
          archivedAt: null,
        },
      },
    );
    expect(prisma.marketingCrmSettingOption.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: expect.objectContaining({
        name: 'Enterprise',
        normalizedName: 'enterprise',
        isActive: false,
        updatedByUserId: 'user-1',
      }),
    });
  });

  it('rejects empty updates as invalid requests', async () => {
    await expect(
      service.update(
        user,
        MarketingCrmSettingCategory.SOURCE_TYPE,
        'setting-1',
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not update through the wrong category endpoint', async () => {
    prisma.marketingCrmSettingOption.findFirst.mockResolvedValue(null);

    await expect(
      service.update(
        user,
        MarketingCrmSettingCategory.SOURCE_TYPE,
        'business-type-id',
        { name: 'Referral' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.marketingCrmSettingOption.update).not.toHaveBeenCalled();
  });

  it('archives records instead of deleting them', async () => {
    prisma.marketingCrmSettingOption.findFirst.mockResolvedValue({
      id: 'setting-1',
    });
    prisma.marketingCrmSettingOption.update.mockResolvedValue({
      id: 'setting-1',
      archivedAt: new Date('2026-09-24T00:00:00.000Z'),
    });

    await service.archive(
      user,
      MarketingCrmSettingCategory.INTERACTION_MEDIUM,
      'setting-1',
    );

    expect(prisma.marketingCrmSettingOption.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        archivedAt: expect.any(Date),
        isActive: false,
        updatedByUserId: 'user-1',
      },
    });
  });

  it('allows name reuse when only archived matching records exist', async () => {
    prisma.marketingCrmSettingOption.findFirst.mockResolvedValue(null);
    prisma.marketingCrmSettingOption.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'setting-2', ...data }),
    );

    await service.create(user, MarketingCrmSettingCategory.SOURCE_TYPE, {
      name: 'Referral',
    });

    expect(prisma.marketingCrmSettingOption.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        category: MarketingCrmSettingCategory.SOURCE_TYPE,
        normalizedName: 'referral',
        archivedAt: null,
      },
      select: { id: true },
    });
  });

  it('rejects duplicate active names before create', async () => {
    prisma.marketingCrmSettingOption.findFirst.mockResolvedValue({
      id: 'existing',
    });

    await expect(
      service.create(user, MarketingCrmSettingCategory.SOURCE_TYPE, {
        name: ' referral ',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.marketingCrmSettingOption.create).not.toHaveBeenCalled();
  });

  it('maps concurrent unique constraint failures to conflict responses', async () => {
    prisma.marketingCrmSettingOption.findFirst.mockResolvedValue(null);
    prisma.marketingCrmSettingOption.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create(user, MarketingCrmSettingCategory.SOURCE_TYPE, {
        name: 'Referral',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('permits the same normalized name in another tenant or category', async () => {
    prisma.marketingCrmSettingOption.findFirst.mockResolvedValue(null);
    prisma.marketingCrmSettingOption.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'setting-1', ...data }),
    );

    await service.create(user, MarketingCrmSettingCategory.SOURCE_TYPE, {
      name: 'Referral',
    });
    await service.create(user, MarketingCrmSettingCategory.INTERACTION_MEDIUM, {
      name: 'Referral',
    });

    expect(prisma.marketingCrmSettingOption.findFirst).toHaveBeenNthCalledWith(
      2,
      {
        where: {
          tenantId: 'tenant-1',
          category: MarketingCrmSettingCategory.INTERACTION_MEDIUM,
          normalizedName: 'referral',
          archivedAt: null,
        },
        select: { id: true },
      },
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

  it('validates invalid request payloads through DTO rules', async () => {
    const dto = plainToInstance(CreateProspectingSettingDto, {
      name: 'x'.repeat(121),
      displayOrder: -1,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['name', 'displayOrder']),
    );
  });
});
