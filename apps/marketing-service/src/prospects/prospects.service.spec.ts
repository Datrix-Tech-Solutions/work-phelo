/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingCrmSettingCategory,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
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
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      marketingProspectProduct: {
        findMany: jest.fn(),
      },
      marketingProspectContact: {
        findMany: jest.fn(),
      },
      marketingProspectInteraction: {
        groupBy: jest.fn(),
      },
    };

    return {
      marketingCrmSettingOption: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      marketingPipelineStage: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      marketingProspect: tx.marketingProspect,
      marketingProspectProduct: tx.marketingProspectProduct,
      marketingProspectContact: tx.marketingProspectContact,
      marketingProspectInteraction: tx.marketingProspectInteraction,
      $transaction: jest.fn(
        (
          input:
            | Array<Promise<unknown>>
            | ((transaction: typeof tx) => unknown),
        ) => {
          if (Array.isArray(input)) return Promise.all(input);
          return Promise.resolve(input(tx));
        },
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
    prisma.marketingProspect.count.mockResolvedValue(0);
    prisma.marketingProspect.findFirst.mockResolvedValue(null);
    prisma.marketingProspect.findMany.mockResolvedValue([]);
    prisma.marketingProspectProduct.findMany.mockResolvedValue([]);
    prisma.marketingProspectContact.findMany.mockResolvedValue([]);
    prisma.marketingProspectInteraction.groupBy.mockResolvedValue([]);
    prisma.marketingPipelineStage.findMany.mockResolvedValue([]);
    prisma.marketingCrmSettingOption.findMany.mockResolvedValue([]);
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

  describe('findOne', () => {
    const prospectDetail = {
      id: 'prospect-a',
      tenantId: 'tenant-1',
      companyName: 'Acme Manufacturing',
      normalizedCompanyName: 'acme manufacturing',
      businessTypeId: 'business-type-1',
      sourceTypeId: 'source-type-1',
      pipelineStageId: 'stage-proposal',
      assignedUserId: 'user-1',
      locationLabel: 'Accra, Ghana',
      latitude: new Prisma.Decimal('5.603700'),
      longitude: new Prisma.Decimal('-0.187000'),
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
      createdAt: new Date('2026-09-28T10:00:00.000Z'),
      updatedAt: new Date('2026-09-29T10:00:00.000Z'),
      contacts: [
        {
          id: 'contact-primary',
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
          name: 'Ama Mensah',
          phone: '+233201234567',
          email: 'ama@example.com',
          decisionMakerTypeId: 'decision-maker-1',
          isPrimary: true,
          createdAt: new Date('2026-09-28T10:05:00.000Z'),
          updatedAt: new Date('2026-09-28T10:05:00.000Z'),
        },
        {
          id: 'contact-secondary',
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
          name: 'Kojo Mensah',
          phone: null,
          email: null,
          decisionMakerTypeId: null,
          isPrimary: false,
          createdAt: new Date('2026-09-28T10:06:00.000Z'),
          updatedAt: new Date('2026-09-28T10:06:00.000Z'),
        },
      ],
      products: [
        {
          id: 'product-row-1',
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
          productId: 'product-1',
          expectedValue: new Prisma.Decimal('10000.00'),
          achievedValue: new Prisma.Decimal('2500.00'),
          commissionRate: new Prisma.Decimal('10.5'),
          commissionAmount: new Prisma.Decimal('1000.00'),
          expectedCloseDate: new Date('2026-10-31T00:00:00.000Z'),
          createdAt: new Date('2026-09-28T10:05:00.000Z'),
          updatedAt: new Date('2026-09-28T10:05:00.000Z'),
        },
        {
          id: 'product-row-2',
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
          productId: 'product-2',
          expectedValue: new Prisma.Decimal('5000.25'),
          achievedValue: null,
          commissionRate: null,
          commissionAmount: null,
          expectedCloseDate: null,
          createdAt: new Date('2026-09-28T10:06:00.000Z'),
          updatedAt: new Date('2026-09-28T10:06:00.000Z'),
        },
      ],
      interactions: [
        {
          id: 'interaction-new',
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
          interactionMediumId: 'interaction-medium-1',
          occurredAt: new Date('2026-09-29T11:00:00.000Z'),
          notes: 'Follow-up call',
          createdByUserId: 'user-1',
          createdAt: new Date('2026-09-29T11:05:00.000Z'),
        },
        {
          id: 'interaction-old',
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
          interactionMediumId: null,
          occurredAt: new Date('2026-09-28T11:00:00.000Z'),
          notes: null,
          createdByUserId: null,
          createdAt: new Date('2026-09-28T11:05:00.000Z'),
        },
      ],
    };

    beforeEach(() => {
      prisma.marketingProspect.findFirst.mockResolvedValue(prospectDetail);
      prisma.marketingPipelineStage.findFirst.mockResolvedValue({
        id: 'stage-proposal',
        name: 'Proposal',
        probability: 60,
        displayOrder: 3,
      });
      prisma.marketingCrmSettingOption.findMany.mockResolvedValue([
        { id: 'business-type-1', name: 'Enterprise' },
        { id: 'source-type-1', name: 'Referral' },
        { id: 'decision-maker-1', name: 'CEO' },
        { id: 'product-1', name: 'Product A' },
        { id: 'product-2', name: 'Service B' },
        { id: 'interaction-medium-1', name: 'Phone Call' },
      ]);
    });

    it('allows the owner to view complete prospect details', async () => {
      const result = await service.findOne(user, 'prospect-a');

      expect(prisma.marketingProspect.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'prospect-a',
          tenantId: 'tenant-1',
          assignedUserId: 'user-1',
        },
        include: {
          contacts: {
            orderBy: [
              { isPrimary: 'desc' },
              { createdAt: 'asc' },
              { id: 'asc' },
            ],
          },
          products: {
            orderBy: [
              { expectedCloseDate: 'asc' },
              { createdAt: 'asc' },
              { id: 'asc' },
            ],
          },
          interactions: {
            orderBy: [
              { occurredAt: 'desc' },
              { createdAt: 'desc' },
              { id: 'asc' },
            ],
          },
        },
      });
      expect(result).toEqual({
        id: 'prospect-a',
        companyName: 'Acme Manufacturing',
        businessType: { id: 'business-type-1', name: 'Enterprise' },
        sourceType: { id: 'source-type-1', name: 'Referral' },
        assignedUserId: 'user-1',
        location: {
          label: 'Accra, Ghana',
          latitude: '5.6037',
          longitude: '-0.187',
        },
        salesStage: {
          id: 'stage-proposal',
          name: 'Proposal',
          probability: 60,
          displayOrder: 3,
        },
        progress: 60,
        contacts: [
          {
            id: 'contact-primary',
            name: 'Ama Mensah',
            phone: '+233201234567',
            email: 'ama@example.com',
            isPrimary: true,
            decisionMaker: { id: 'decision-maker-1', name: 'CEO' },
          },
          {
            id: 'contact-secondary',
            name: 'Kojo Mensah',
            phone: null,
            email: null,
            isPrimary: false,
            decisionMaker: null,
          },
        ],
        products: [
          {
            id: 'product-row-1',
            product: { id: 'product-1', name: 'Product A' },
            expectedValue: '10000.00',
            achievedValue: '2500.00',
            commissionRate: '10.5',
            commissionAmount: '1000.00',
            expectedCloseDate: new Date('2026-10-31T00:00:00.000Z'),
          },
          {
            id: 'product-row-2',
            product: { id: 'product-2', name: 'Service B' },
            expectedValue: '5000.25',
            achievedValue: null,
            commissionRate: null,
            commissionAmount: null,
            expectedCloseDate: null,
          },
        ],
        totalExpectedValue: '15000.25',
        totalAchievedValue: '2500.00',
        interactions: [
          {
            id: 'interaction-new',
            occurredAt: new Date('2026-09-29T11:00:00.000Z'),
            interactionMedium: {
              id: 'interaction-medium-1',
              name: 'Phone Call',
            },
            notes: 'Follow-up call',
            createdByUserId: 'user-1',
            createdAt: new Date('2026-09-29T11:05:00.000Z'),
          },
          {
            id: 'interaction-old',
            occurredAt: new Date('2026-09-28T11:00:00.000Z'),
            interactionMedium: null,
            notes: null,
            createdByUserId: null,
            createdAt: new Date('2026-09-28T11:05:00.000Z'),
          },
        ],
        createdAt: new Date('2026-09-28T10:00:00.000Z'),
        updatedAt: new Date('2026-09-29T10:00:00.000Z'),
      });
    });

    it('allows VIEW_ALL users to view another user prospect within the same tenant', async () => {
      await service.findOne(
        {
          ...user,
          permissions: [
            MarketingCrmSettingsPermission.PROSPECTS_VIEW,
            MarketingCrmSettingsPermission.PROSPECTS_VIEW_ALL,
          ],
        },
        'prospect-a',
      );

      expect(prisma.marketingProspect.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'prospect-a',
            tenantId: 'tenant-1',
          },
        }),
      );
    });

    it('returns non-disclosing not found for another user prospect, cross-tenant prospect or missing prospect', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(user, 'prospect-other'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.marketingPipelineStage.findFirst).not.toHaveBeenCalled();
      expect(prisma.marketingCrmSettingOption.findMany).not.toHaveBeenCalled();
    });

    it('keeps archived referenced settings displayable by not filtering archivedAt on detail references', async () => {
      await service.findOne(user, 'prospect-a');

      expect(prisma.marketingCrmSettingOption.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          id: {
            in: [
              'business-type-1',
              'source-type-1',
              'decision-maker-1',
              'product-1',
              'product-2',
              'interaction-medium-1',
            ],
          },
        },
        select: { id: true, name: true },
      });
      expect(prisma.marketingPipelineStage.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'stage-proposal',
          tenantId: 'tenant-1',
        },
        select: {
          id: true,
          name: true,
          probability: true,
          displayOrder: true,
        },
      });
    });

    it('handles empty optional interactions and references safely', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValue({
        ...prospectDetail,
        businessTypeId: null,
        sourceTypeId: null,
        contacts: [],
        products: [],
        interactions: [],
      });
      prisma.marketingCrmSettingOption.findMany.mockResolvedValue([]);

      const result = await service.findOne(user, 'prospect-a');

      expect(result).toEqual(
        expect.objectContaining({
          businessType: null,
          sourceType: null,
          contacts: [],
          products: [],
          totalExpectedValue: '0.00',
          totalAchievedValue: '0.00',
          interactions: [],
        }),
      );
    });
  });

  describe('list', () => {
    const prospectA = {
      id: 'prospect-a',
      companyName: 'Acme Manufacturing',
      pipelineStageId: 'stage-proposal',
      assignedUserId: 'user-1',
      createdAt: new Date('2026-09-28T10:00:00.000Z'),
    };
    const prospectB = {
      id: 'prospect-b',
      companyName: 'Beta Logistics',
      pipelineStageId: 'stage-qualified',
      assignedUserId: 'user-2',
      createdAt: new Date('2026-09-27T10:00:00.000Z'),
    };

    beforeEach(() => {
      prisma.marketingProspect.count.mockResolvedValue(1);
      prisma.marketingProspect.findMany.mockResolvedValue([prospectA]);
      prisma.marketingProspectProduct.findMany.mockResolvedValue([
        {
          id: 'product-row-1',
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
          productId: 'product-1',
          expectedValue: new Prisma.Decimal('10000.00'),
          achievedValue: new Prisma.Decimal('2500.00'),
          commissionRate: null,
          commissionAmount: null,
          expectedCloseDate: new Date('2026-10-31T00:00:00.000Z'),
          createdAt: new Date('2026-09-28T10:05:00.000Z'),
          updatedAt: new Date('2026-09-28T10:05:00.000Z'),
        },
        {
          id: 'product-row-2',
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
          productId: 'product-2',
          expectedValue: new Prisma.Decimal('5000.25'),
          achievedValue: null,
          commissionRate: null,
          commissionAmount: null,
          expectedCloseDate: new Date('2026-10-15T00:00:00.000Z'),
          createdAt: new Date('2026-09-28T10:06:00.000Z'),
          updatedAt: new Date('2026-09-28T10:06:00.000Z'),
        },
      ]);
      prisma.marketingProspectContact.findMany.mockResolvedValue([
        {
          id: 'contact-1',
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
          name: 'Ama Mensah',
          phone: '+233201234567',
          email: 'ama@example.com',
          decisionMakerTypeId: 'decision-maker-1',
          isPrimary: true,
          createdAt: new Date('2026-09-28T10:05:00.000Z'),
          updatedAt: new Date('2026-09-28T10:05:00.000Z'),
        },
      ]);
      prisma.marketingProspectInteraction.groupBy.mockResolvedValue([
        {
          prospectId: 'prospect-a',
          _max: {
            occurredAt: new Date('2026-09-29T11:00:00.000Z'),
          },
        },
      ]);
      prisma.marketingPipelineStage.findMany.mockResolvedValue([
        {
          id: 'stage-proposal',
          name: 'Proposal',
          probability: 60,
        },
      ]);
      prisma.marketingCrmSettingOption.findMany.mockResolvedValue([
        { id: 'product-1', name: 'Product A' },
        { id: 'product-2', name: 'Service B' },
        { id: 'decision-maker-1', name: 'CEO' },
      ]);
    });

    it('returns only assigned prospects for users with VIEW only', async () => {
      await service.list(
        {
          ...user,
          permissions: [MarketingCrmSettingsPermission.PROSPECTS_VIEW],
        },
        { assignedUserId: 'user-2' },
      );

      expect(prisma.marketingProspect.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            assignedUserId: 'user-1',
          }),
        }),
      );
    });

    it('allows VIEW_ALL users to list tenant-wide prospects and filter by assigned user', async () => {
      prisma.marketingProspect.count.mockResolvedValue(2);
      prisma.marketingProspect.findMany.mockResolvedValue([
        prospectA,
        prospectB,
      ]);

      await service.list(
        {
          ...user,
          permissions: [
            MarketingCrmSettingsPermission.PROSPECTS_VIEW,
            MarketingCrmSettingsPermission.PROSPECTS_VIEW_ALL,
          ],
        },
        { assignedUserId: 'user-2', page: 2, limit: 10 },
      );

      expect(prisma.marketingProspect.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            assignedUserId: 'user-2',
          }),
          skip: 10,
          take: 10,
        }),
      );
    });

    it('applies tenant, company-name search, creation-date filters, pagination and deterministic ordering', async () => {
      await service.list(user, {
        search: '  ACME   Manu ',
        createdFrom: '2026-09-01',
        createdTo: '2026-09-30',
        page: 3,
        limit: 25,
      });

      expect(prisma.marketingProspect.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            assignedUserId: 'user-1',
            normalizedCompanyName: { contains: 'acme manu' },
            createdAt: {
              gte: new Date('2026-09-01T00:00:00.000Z'),
              lte: new Date('2026-09-30T23:59:59.999Z'),
            },
          },
          orderBy: [
            { createdAt: 'desc' },
            { companyName: 'asc' },
            { id: 'asc' },
          ],
          skip: 50,
          take: 25,
        }),
      );
    });

    it('returns row-ready prospect data without per-prospect queries', async () => {
      const result = await service.list(user, { page: 1, limit: 20 });

      expect(result).toEqual({
        data: [
          {
            id: 'prospect-a',
            companyName: 'Acme Manufacturing',
            expectedValue: '15000.25',
            achievedValue: '2500.00',
            products: [
              { id: 'product-1', name: 'Product A' },
              { id: 'product-2', name: 'Service B' },
            ],
            primaryContact: {
              name: 'Ama Mensah',
              phone: '+233201234567',
              decisionMaker: { id: 'decision-maker-1', name: 'CEO' },
            },
            salesStage: {
              id: 'stage-proposal',
              name: 'Proposal',
              probability: 60,
            },
            progress: 60,
            lastInteractionDate: new Date('2026-09-29T11:00:00.000Z'),
            expectedCloseDate: new Date('2026-10-15T00:00:00.000Z'),
            assignedUserId: 'user-1',
            createdAt: new Date('2026-09-28T10:00:00.000Z'),
          },
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      expect(prisma.marketingProspectProduct.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.marketingProspectContact.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.marketingProspectInteraction.groupBy).toHaveBeenCalledTimes(
        1,
      );
      expect(prisma.marketingPipelineStage.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.marketingCrmSettingOption.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          id: { in: ['product-1', 'product-2', 'decision-maker-1'] },
        },
        select: { id: true, name: true },
      });
    });

    it('keeps archived referenced settings displayable by not filtering archivedAt on list references', async () => {
      await service.list(user, {});

      expect(prisma.marketingCrmSettingOption.findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({
          where: expect.objectContaining({ archivedAt: null }),
        }),
      );
      expect(prisma.marketingPipelineStage.findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({
          where: expect.objectContaining({ archivedAt: null }),
        }),
      );
    });

    it('returns null values for optional row fields when a prospect has no primary contact, products or interactions', async () => {
      prisma.marketingProspectProduct.findMany.mockResolvedValue([]);
      prisma.marketingProspectContact.findMany.mockResolvedValue([]);
      prisma.marketingProspectInteraction.groupBy.mockResolvedValue([]);
      prisma.marketingCrmSettingOption.findMany.mockResolvedValue([]);

      const result = await service.list(user, {});

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          expectedValue: '0.00',
          achievedValue: '0.00',
          products: [],
          primaryContact: null,
          lastInteractionDate: null,
          expectedCloseDate: null,
        }),
      );
    });

    it('short-circuits related lookups when the page is empty', async () => {
      prisma.marketingProspect.count.mockResolvedValue(0);
      prisma.marketingProspect.findMany.mockResolvedValue([]);

      const result = await service.list(user, {});

      expect(result).toEqual({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
      });
      expect(prisma.marketingProspectProduct.findMany).not.toHaveBeenCalled();
      expect(prisma.marketingProspectContact.findMany).not.toHaveBeenCalled();
      expect(
        prisma.marketingProspectInteraction.groupBy,
      ).not.toHaveBeenCalled();
    });
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
