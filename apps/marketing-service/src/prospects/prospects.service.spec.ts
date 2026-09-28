/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestUser } from '@work-phelo/types';
import { MarketingCrmSettingCategory } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProspectDto } from './dto/create-prospect.dto';
import { ProspectsService } from './prospects.service';

describe('ProspectsService', () => {
  const user: RequestUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'sales@example.com',
    role: 'EMPLOYEE',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    firstName: 'Ada',
    moduleConfig: {},
    featureConfig: {},
    integrationConfig: {},
    permissions: [],
  };

  const makeDto = (): CreateProspectDto => ({
    companyName: '  Acme   Manufacturing  ',
    businessTypeId: '11111111-1111-4111-8111-111111111111',
    sourceTypeId: '22222222-2222-4222-8222-222222222222',
    pipelineStageId: '33333333-3333-4333-8333-333333333333',
    primaryContact: {
      name: '  Ama   Mensah ',
      phone: ' +233201234567 ',
      email: 'Ama.Mensah@example.com',
      decisionMakerTypeId: '44444444-4444-4444-8444-444444444444',
    },
    products: [
      {
        productId: '55555555-5555-4555-8555-555555555555',
        expectedValue: 10000,
        achievedValue: 2500,
        commissionRate: 10,
        commissionAmount: 1000,
        expectedCloseDate: '2026-10-31',
      },
    ],
    location: {
      label: '  Accra,   Ghana ',
      latitude: 5.6037,
      longitude: -0.187,
    },
    initialInteraction: {
      interactionMediumId: '66666666-6666-4666-8666-666666666666',
      occurredAt: '2026-09-28',
      notes: '  Initial   discovery call ',
    },
  });

  const makePrisma = () => {
    const tx = {
      marketingProspect: {
        create: jest.fn(),
      },
    };

    return {
      marketingCrmSettingOption: {
        findFirst: jest.fn(),
      },
      marketingPipelineStage: {
        findFirst: jest.fn(),
      },
      marketingProspect: tx.marketingProspect,
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    };
  };

  let prisma: ReturnType<typeof makePrisma>;
  let service: ProspectsService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.marketingPipelineStage.findFirst.mockResolvedValue({
      id: 'stage',
    });
    prisma.marketingCrmSettingOption.findFirst.mockResolvedValue({
      id: 'setting',
    });
    prisma.marketingProspect.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'prospect-1',
        ...data,
        createdAt: new Date('2026-09-28T00:00:00.000Z'),
        updatedAt: new Date('2026-09-28T00:00:00.000Z'),
      }),
    );
    service = new ProspectsService(prisma as unknown as PrismaService);
  });

  it('creates a tenant-scoped prospect aggregate in one transaction', async () => {
    const result = await service.create(user, makeDto());

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.marketingProspect.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        companyName: 'Acme Manufacturing',
        normalizedCompanyName: 'acme manufacturing',
        businessTypeId: '11111111-1111-4111-8111-111111111111',
        sourceTypeId: '22222222-2222-4222-8222-222222222222',
        pipelineStageId: '33333333-3333-4333-8333-333333333333',
        assignedUserId: 'user-1',
        locationLabel: 'Accra, Ghana',
        latitude: 5.6037,
        longitude: -0.187,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
      }),
      include: {
        contacts: true,
        products: true,
        interactions: true,
      },
    });

    const createArg = prisma.marketingProspect.create.mock.calls[0][0];
    expect(createArg.data).not.toHaveProperty('createdAt');
    expect(createArg.data.contacts.create).toEqual({
      tenantId: 'tenant-1',
      name: 'Ama Mensah',
      phone: '+233201234567',
      email: 'Ama.Mensah@example.com',
      decisionMakerTypeId: '44444444-4444-4444-8444-444444444444',
      isPrimary: true,
    });
    expect(createArg.data.products.create).toEqual([
      {
        tenantId: 'tenant-1',
        productId: '55555555-5555-4555-8555-555555555555',
        expectedValue: 10000,
        achievedValue: 2500,
        commissionRate: 10,
        commissionAmount: 1000,
        expectedCloseDate: new Date('2026-10-31'),
      },
    ]);
    expect(createArg.data.interactions.create).toEqual({
      tenantId: 'tenant-1',
      interactionMediumId: '66666666-6666-4666-8666-666666666666',
      occurredAt: new Date('2026-09-28'),
      notes: 'Initial discovery call',
      createdByUserId: 'user-1',
    });
    expect(result.assignedUserId).toBe('user-1');
  });

  it('validates stage and all supplied CRM setting references as active tenant records', async () => {
    await service.create(user, makeDto());

    expect(prisma.marketingPipelineStage.findFirst).toHaveBeenCalledWith({
      where: {
        id: '33333333-3333-4333-8333-333333333333',
        tenantId: 'tenant-1',
        archivedAt: null,
        isActive: true,
      },
      select: { id: true },
    });
    expect(prisma.marketingCrmSettingOption.findFirst).toHaveBeenCalledWith({
      where: {
        id: '55555555-5555-4555-8555-555555555555',
        tenantId: 'tenant-1',
        category: MarketingCrmSettingCategory.PRODUCT,
        archivedAt: null,
        isActive: true,
      },
      select: { id: true },
    });
  });

  it('rejects cross-tenant, archived, inactive or wrong-category settings without creating records', async () => {
    prisma.marketingCrmSettingOption.findFirst.mockResolvedValueOnce(null);

    await expect(service.create(user, makeDto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.marketingProspect.create).not.toHaveBeenCalled();
  });

  it('rejects missing, archived, inactive or cross-tenant pipeline stages', async () => {
    prisma.marketingPipelineStage.findFirst.mockResolvedValue(null);

    await expect(service.create(user, makeDto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate product references before opening the transaction', async () => {
    const dto = makeDto();
    dto.products.push({ ...dto.products[0] });

    await expect(service.create(user, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.marketingCrmSettingOption.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('propagates transaction failures so child create failures roll back the aggregate', async () => {
    prisma.marketingProspect.create.mockRejectedValue(
      new Error('child failed'),
    );

    await expect(service.create(user, makeDto())).rejects.toThrow(
      'child failed',
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  describe('CreateProspectDto validation', () => {
    async function validateDto(payload: unknown) {
      return validate(plainToInstance(CreateProspectDto, payload));
    }

    it('requires company name, primary contact, products, location and stage', async () => {
      const errors = await validateDto({});

      expect(errors.map((error) => error.property)).toEqual(
        expect.arrayContaining([
          'companyName',
          'pipelineStageId',
          'primaryContact',
          'products',
          'location',
        ]),
      );
    });

    it('rejects empty product arrays', async () => {
      const dto = makeDto();
      dto.products = [];

      const errors = await validateDto(dto);

      expect(errors.some((error) => error.property === 'products')).toBe(true);
    });

    it('rejects missing location details', async () => {
      const dto = makeDto();
      dto.location = {} as never;

      const errors = await validateDto(dto);

      expect(errors.some((error) => error.property === 'location')).toBe(true);
    });

    it('validates UUIDs, email format, money fields and expected close dates', async () => {
      const dto = makeDto();
      dto.pipelineStageId = 'not-a-uuid';
      dto.primaryContact.email = 'not-an-email';
      dto.products[0].expectedValue = -1;
      dto.products[0].expectedCloseDate = 'not-a-date';

      const errors = await validateDto(dto);
      const properties = errors.map((error) => error.property);

      expect(properties).toEqual(
        expect.arrayContaining([
          'pipelineStageId',
          'primaryContact',
          'products',
        ]),
      );
    });
  });
});
