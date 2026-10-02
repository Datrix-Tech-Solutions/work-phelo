/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingCrmSettingCategory,
  MarketingProspectFollowUpStatus,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { CreateProspectDto } from './dto/create-prospect.dto';
import { CreateProspectInteractionDto } from './dto/create-prospect-interaction.dto';
import {
  CreateProspectFollowUpDto,
  UpdateProspectFollowUpDto,
} from './dto/prospect-follow-up.dto';
import { UpdateProspectDto } from './dto/update-prospect.dto';
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

  const makeExistingProspect = () => ({
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
        expectedValue: new Prisma.Decimal('5000.00'),
        achievedValue: null,
        commissionRate: null,
        commissionAmount: null,
        expectedCloseDate: null,
        createdAt: new Date('2026-09-28T10:06:00.000Z'),
        updatedAt: new Date('2026-09-28T10:06:00.000Z'),
      },
    ],
    interactions: [],
  });

  const makePrisma = () => {
    const tx = {
      marketingProspect: {
        create: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      marketingProspectProduct: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      marketingProspectContact: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      marketingProspectInteraction: {
        create: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      marketingProspectFollowUp: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      marketingCrmSettingOption: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    return {
      marketingCrmSettingOption: {
        findFirst: tx.marketingCrmSettingOption.findFirst,
        findMany: tx.marketingCrmSettingOption.findMany,
      },
      marketingPipelineStage: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      marketingProspect: tx.marketingProspect,
      marketingProspectProduct: tx.marketingProspectProduct,
      marketingProspectContact: tx.marketingProspectContact,
      marketingProspectInteraction: tx.marketingProspectInteraction,
      marketingProspectFollowUp: tx.marketingProspectFollowUp,
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
    prisma.marketingProspect.delete.mockResolvedValue({});
    prisma.marketingProspect.findFirst.mockResolvedValue(null);
    prisma.marketingProspect.findMany.mockResolvedValue([]);
    prisma.marketingProspect.update.mockResolvedValue({});
    prisma.marketingProspectProduct.create.mockResolvedValue({});
    prisma.marketingProspectProduct.deleteMany.mockResolvedValue({ count: 0 });
    prisma.marketingProspectProduct.findMany.mockResolvedValue([]);
    prisma.marketingProspectProduct.update.mockResolvedValue({});
    prisma.marketingProspectContact.create.mockResolvedValue({});
    prisma.marketingProspectContact.findMany.mockResolvedValue([]);
    prisma.marketingProspectContact.update.mockResolvedValue({});
    prisma.marketingProspectInteraction.groupBy.mockResolvedValue([]);
    prisma.marketingProspectInteraction.create.mockResolvedValue({});
    prisma.marketingProspectInteraction.findMany.mockResolvedValue([]);
    prisma.marketingProspectFollowUp.create.mockResolvedValue({});
    prisma.marketingProspectFollowUp.findFirst.mockResolvedValue(null);
    prisma.marketingProspectFollowUp.findMany.mockResolvedValue([]);
    prisma.marketingProspectFollowUp.update.mockResolvedValue({});
    prisma.marketingProspectFollowUp.updateMany.mockResolvedValue({ count: 1 });
    prisma.marketingPipelineStage.findMany.mockResolvedValue([]);
    prisma.marketingCrmSettingOption.findMany.mockResolvedValue([]);
    service = new ProspectsService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
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
      decisionMakerInvolved: false,
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
          decisionMakerInvolved: true,
          createdByUserId: 'user-1',
          createdAt: new Date('2026-09-29T11:05:00.000Z'),
          participants: [
            {
              id: 'participant-1',
              tenantId: 'tenant-1',
              interactionId: 'interaction-new',
              fullName: 'Ama Mensah',
              phone: '+233201234567',
              role: 'Finance Director',
              createdAt: new Date('2026-09-29T11:06:00.000Z'),
            },
          ],
        },
        {
          id: 'interaction-old',
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
          interactionMediumId: null,
          occurredAt: new Date('2026-09-28T11:00:00.000Z'),
          notes: null,
          decisionMakerInvolved: false,
          createdByUserId: null,
          createdAt: new Date('2026-09-28T11:05:00.000Z'),
          participants: [],
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
            include: {
              participants: {
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              },
            },
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
            decisionMakerInvolved: true,
            participants: [
              {
                id: 'participant-1',
                fullName: 'Ama Mensah',
                phone: '+233201234567',
                role: 'Finance Director',
                createdAt: new Date('2026-09-29T11:06:00.000Z'),
              },
            ],
            createdByUserId: 'user-1',
            createdAt: new Date('2026-09-29T11:05:00.000Z'),
          },
          {
            id: 'interaction-old',
            occurredAt: new Date('2026-09-28T11:00:00.000Z'),
            interactionMedium: null,
            notes: null,
            decisionMakerInvolved: false,
            participants: [],
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

  describe('interactions', () => {
    const interactionDto = (): CreateProspectInteractionDto => ({
      occurredAt: '2026-09-30T10:30:00.000Z',
      interactionMediumId: '66666666-6666-4666-8666-666666666666',
      notes: ' Discussed   renewal requirements ',
      decisionMakerInvolved: true,
      participants: [
        {
          fullName: ' Ama  Mensah ',
          phone: ' +233201234567 ',
          role: ' Finance  Director ',
        },
        {
          fullName: ' Kojo  Mensah ',
          phone: '+233209876543',
          role: 'Operations Lead',
        },
      ],
    });

    const recordedInteraction = {
      id: 'interaction-1',
      tenantId: 'tenant-1',
      prospectId: 'prospect-a',
      interactionMediumId: '66666666-6666-4666-8666-666666666666',
      occurredAt: new Date('2026-09-30T10:30:00.000Z'),
      notes: 'Discussed renewal requirements',
      decisionMakerInvolved: true,
      createdByUserId: 'user-1',
      createdAt: new Date('2026-09-30T10:31:00.000Z'),
      participants: [
        {
          id: 'participant-1',
          tenantId: 'tenant-1',
          interactionId: 'interaction-1',
          fullName: 'Ama Mensah',
          phone: '+233201234567',
          role: 'Finance Director',
          createdAt: new Date('2026-09-30T10:32:00.000Z'),
        },
        {
          id: 'participant-2',
          tenantId: 'tenant-1',
          interactionId: 'interaction-1',
          fullName: 'Kojo Mensah',
          phone: '+233209876543',
          role: 'Operations Lead',
          createdAt: new Date('2026-09-30T10:33:00.000Z'),
        },
      ],
    };

    it('records an assigned prospect interaction and participants transactionally', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValue({
        id: 'prospect-a',
      });
      prisma.marketingProspectInteraction.create.mockResolvedValue(
        recordedInteraction,
      );
      prisma.marketingCrmSettingOption.findMany.mockResolvedValue([
        {
          id: '66666666-6666-4666-8666-666666666666',
          name: 'Phone Call',
        },
      ]);

      const result = await service.createInteraction(
        {
          ...user,
          permissions: [
            MarketingCrmSettingsPermission.PROSPECT_INTERACTIONS_CREATE,
          ],
        },
        'prospect-a',
        interactionDto(),
      );

      expect(prisma.marketingProspect.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'prospect-a',
          tenantId: 'tenant-1',
          assignedUserId: 'user-1',
        },
        select: { id: true },
      });
      expect(prisma.marketingCrmSettingOption.findFirst).toHaveBeenCalledWith({
        where: {
          id: '66666666-6666-4666-8666-666666666666',
          tenantId: 'tenant-1',
          category: MarketingCrmSettingCategory.INTERACTION_MEDIUM,
          archivedAt: null,
          isActive: true,
        },
        select: { id: true },
      });
      expect(prisma.marketingProspectInteraction.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
          interactionMediumId: '66666666-6666-4666-8666-666666666666',
          occurredAt: new Date('2026-09-30T10:30:00.000Z'),
          notes: 'Discussed renewal requirements',
          decisionMakerInvolved: true,
          createdByUserId: 'user-1',
          participants: {
            create: [
              {
                tenantId: 'tenant-1',
                fullName: 'Ama Mensah',
                phone: '+233201234567',
                role: 'Finance Director',
              },
              {
                tenantId: 'tenant-1',
                fullName: 'Kojo Mensah',
                phone: '+233209876543',
                role: 'Operations Lead',
              },
            ],
          },
        },
        include: {
          participants: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
      });
      expect(prisma.marketingProspect.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: 'interaction-1',
        occurredAt: new Date('2026-09-30T10:30:00.000Z'),
        interactionMedium: {
          id: '66666666-6666-4666-8666-666666666666',
          name: 'Phone Call',
        },
        notes: 'Discussed renewal requirements',
        decisionMakerInvolved: true,
        participants: [
          {
            id: 'participant-1',
            fullName: 'Ama Mensah',
            phone: '+233201234567',
            role: 'Finance Director',
            createdAt: new Date('2026-09-30T10:32:00.000Z'),
          },
          {
            id: 'participant-2',
            fullName: 'Kojo Mensah',
            phone: '+233209876543',
            role: 'Operations Lead',
            createdAt: new Date('2026-09-30T10:33:00.000Z'),
          },
        ],
        createdByUserId: 'user-1',
        createdAt: new Date('2026-09-30T10:31:00.000Z'),
      });
    });

    it('allows CREATE_ALL users to record interactions for another assigned user prospect', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValue({
        id: 'prospect-a',
      });
      prisma.marketingProspectInteraction.create.mockResolvedValue({
        ...recordedInteraction,
        participants: [],
      });

      await service.createInteraction(
        {
          ...user,
          permissions: [
            MarketingCrmSettingsPermission.PROSPECT_INTERACTIONS_CREATE,
            MarketingCrmSettingsPermission.PROSPECT_INTERACTIONS_CREATE_ALL,
          ],
        },
        'prospect-a',
        { ...interactionDto(), participants: [] },
      );

      expect(prisma.marketingProspect.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'prospect-a',
          tenantId: 'tenant-1',
        },
        select: { id: true },
      });
    });

    it('rejects inaccessible, cross-tenant or missing prospects before interaction creation', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValue(null);

      await expect(
        service.createInteraction(user, 'prospect-other', interactionDto()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.marketingCrmSettingOption.findFirst).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects inactive, archived, wrong-category or cross-tenant interaction media', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValue({
        id: 'prospect-a',
      });
      prisma.marketingCrmSettingOption.findFirst.mockResolvedValue(null);

      await expect(
        service.createInteraction(user, 'prospect-a', interactionDto()),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.marketingProspectInteraction.create).not.toHaveBeenCalled();
    });

    it('propagates transaction failures so participants do not partially persist', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValue({
        id: 'prospect-a',
      });
      prisma.marketingProspectInteraction.create.mockRejectedValue(
        new Error('participant create failed'),
      );

      await expect(
        service.createInteraction(user, 'prospect-a', interactionDto()),
      ).rejects.toThrow('participant create failed');
    });

    it('rejects follow-up completion through the generic interaction endpoint', async () => {
      await expect(
        service.createInteraction(user, 'prospect-a', {
          ...interactionDto(),
          followUpId: '77777777-7777-4777-8777-777777777777',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.marketingProspect.findFirst).not.toHaveBeenCalled();
      expect(prisma.marketingProspectInteraction.create).not.toHaveBeenCalled();
      expect(
        prisma.marketingProspectFollowUp.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('returns interaction history with archived medium names and deterministic ordering', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValue({
        id: 'prospect-a',
      });
      prisma.marketingProspectInteraction.findMany.mockResolvedValue([
        recordedInteraction,
        {
          ...recordedInteraction,
          id: 'interaction-older',
          interactionMediumId: 'archived-medium',
          occurredAt: new Date('2026-09-28T10:30:00.000Z'),
          decisionMakerInvolved: false,
          participants: [],
        },
      ]);
      prisma.marketingCrmSettingOption.findMany.mockResolvedValue([
        {
          id: '66666666-6666-4666-8666-666666666666',
          name: 'Phone Call',
        },
        { id: 'archived-medium', name: 'Archived Medium' },
      ]);

      const result = await service.listInteractions(user, 'prospect-a');

      expect(prisma.marketingProspectInteraction.findMany).toHaveBeenCalledWith(
        {
          where: {
            tenantId: 'tenant-1',
            prospectId: 'prospect-a',
          },
          orderBy: [
            { occurredAt: 'desc' },
            { createdAt: 'desc' },
            { id: 'asc' },
          ],
          include: {
            participants: {
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            },
          },
        },
      );
      expect(prisma.marketingCrmSettingOption.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          id: {
            in: ['66666666-6666-4666-8666-666666666666', 'archived-medium'],
          },
        },
        select: { id: true, name: true },
      });
      expect(result.items).toEqual([
        expect.objectContaining({
          id: 'interaction-1',
          decisionMakerInvolved: true,
          participants: expect.any(Array),
        }),
        expect.objectContaining({
          id: 'interaction-older',
          interactionMedium: { id: 'archived-medium', name: 'Archived Medium' },
          decisionMakerInvolved: false,
          participants: [],
        }),
      ]);
    });

    it('rejects interaction history for inaccessible prospects', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValue(null);

      await expect(
        service.listInteractions(user, 'prospect-other'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(
        prisma.marketingProspectInteraction.findMany,
      ).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates an assigned prospect aggregate and returns the detail response shape', async () => {
      const existing = makeExistingProspect();
      prisma.marketingProspect.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({
          ...existing,
          companyName: 'Beta Industries',
          normalizedCompanyName: 'beta industries',
          businessTypeId: 'business-type-2',
          sourceTypeId: null,
          pipelineStageId: 'stage-negotiation',
          locationLabel: 'Kumasi, Ghana',
          latitude: new Prisma.Decimal('6.6885'),
          longitude: new Prisma.Decimal('-1.6244'),
          contacts: [
            {
              ...existing.contacts[0],
              name: 'Akua Boateng',
              phone: null,
              email: 'akua@example.com',
              decisionMakerTypeId: 'decision-maker-2',
            },
          ],
          products: [
            {
              ...existing.products[0],
              productId: 'product-3',
              expectedValue: new Prisma.Decimal('20000.00'),
              achievedValue: null,
              commissionRate: null,
              commissionAmount: new Prisma.Decimal('1500.00'),
              expectedCloseDate: null,
            },
            {
              id: 'product-row-3',
              tenantId: 'tenant-1',
              prospectId: 'prospect-a',
              productId: 'product-4',
              expectedValue: new Prisma.Decimal('5000.00'),
              achievedValue: null,
              commissionRate: null,
              commissionAmount: null,
              expectedCloseDate: new Date('2026-11-01T00:00:00.000Z'),
              createdAt: new Date('2026-09-30T10:00:00.000Z'),
              updatedAt: new Date('2026-09-30T10:00:00.000Z'),
            },
          ],
        });
      prisma.marketingPipelineStage.findFirst.mockResolvedValue({
        id: 'stage-negotiation',
        name: 'Negotiation',
        probability: 80,
        displayOrder: 4,
      });
      prisma.marketingCrmSettingOption.findMany.mockResolvedValue([
        { id: 'business-type-2', name: 'Corporate' },
        { id: 'decision-maker-2', name: 'CFO' },
        { id: 'product-3', name: 'Product C' },
        { id: 'product-4', name: 'Service D' },
      ]);

      const result = await service.update(user, 'prospect-a', {
        companyName: '  Beta   Industries ',
        businessTypeId: 'business-type-2',
        sourceTypeId: null,
        pipelineStageId: 'stage-negotiation',
        primaryContact: {
          name: ' Akua  Boateng ',
          phone: ' ',
          email: 'akua@example.com',
          decisionMakerTypeId: 'decision-maker-2',
        },
        products: [
          {
            id: 'product-row-1',
            productId: 'product-3',
            expectedValue: 20000,
            achievedValue: null,
            commissionRate: null,
            commissionAmount: 1500,
            expectedCloseDate: null,
          },
          {
            productId: 'product-4',
            expectedValue: 5000,
            expectedCloseDate: '2026-11-01',
          },
        ],
        location: {
          label: ' Kumasi,  Ghana ',
          latitude: 6.6885,
          longitude: -1.6244,
        },
      });

      expect(prisma.marketingProspect.findFirst).toHaveBeenNthCalledWith(1, {
        where: {
          id: 'prospect-a',
          tenantId: 'tenant-1',
          assignedUserId: 'user-1',
        },
        include: {
          contacts: true,
          products: true,
        },
      });
      expect(prisma.marketingProspect.update).toHaveBeenCalledWith({
        where: { id: 'prospect-a' },
        data: expect.objectContaining({
          companyName: 'Beta Industries',
          normalizedCompanyName: 'beta industries',
          businessTypeId: 'business-type-2',
          sourceTypeId: null,
          pipelineStageId: 'stage-negotiation',
          locationLabel: 'Kumasi, Ghana',
          latitude: 6.6885,
          longitude: -1.6244,
          updatedByUserId: 'user-1',
        }),
      });
      expect(prisma.marketingProspectContact.update).toHaveBeenCalledWith({
        where: { id: 'contact-primary' },
        data: {
          name: 'Akua Boateng',
          phone: null,
          email: 'akua@example.com',
          decisionMakerTypeId: 'decision-maker-2',
        },
      });
      expect(prisma.marketingProspectProduct.deleteMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
          id: { notIn: ['product-row-1'] },
        },
      });
      expect(prisma.marketingProspectProduct.update).toHaveBeenCalledWith({
        where: { id: 'product-row-1' },
        data: {
          productId: 'product-3',
          expectedValue: 20000,
          achievedValue: null,
          commissionRate: null,
          commissionAmount: 1500,
          expectedCloseDate: null,
        },
      });
      expect(prisma.marketingProspectProduct.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
          productId: 'product-4',
          expectedValue: 5000,
          achievedValue: null,
          commissionRate: null,
          commissionAmount: null,
          expectedCloseDate: new Date('2026-11-01'),
        },
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: 'prospect-a',
          companyName: 'Beta Industries',
          totalExpectedValue: '25000.00',
          totalAchievedValue: '0.00',
        }),
      );
    });

    it('allows EDIT_ALL users to update another user prospect within the same tenant', async () => {
      const existing = {
        ...makeExistingProspect(),
        assignedUserId: 'user-2',
      };
      prisma.marketingProspect.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(existing);

      await service.update(
        {
          ...user,
          permissions: [
            MarketingCrmSettingsPermission.PROSPECTS_EDIT,
            MarketingCrmSettingsPermission.PROSPECTS_EDIT_ALL,
          ],
        },
        'prospect-a',
        { companyName: 'Updated Prospect' },
      );

      expect(prisma.marketingProspect.findFirst).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: {
            id: 'prospect-a',
            tenantId: 'tenant-1',
          },
        }),
      );
    });

    it('returns non-disclosing not found for missing, cross-tenant or unassigned prospects', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValue(null);

      await expect(
        service.update(user, 'prospect-other', { companyName: 'Updated' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects empty patches, empty product sets and unknown product association ids', async () => {
      const existing = makeExistingProspect();
      prisma.marketingProspect.findFirst.mockResolvedValue(existing);

      await expect(service.update(user, 'prospect-a', {})).rejects.toThrow(
        'At least one field is required',
      );
      await expect(
        service.update(user, 'prospect-a', { products: [] }),
      ).rejects.toThrow('A prospect must have at least one product');
      await expect(
        service.update(user, 'prospect-a', {
          products: [{ id: 'missing-row', expectedValue: 100 }],
        }),
      ).rejects.toThrow('Invalid prospect product reference');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects inactive, archived, cross-tenant or wrong-category changed references before updating', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValue(
        makeExistingProspect(),
      );
      prisma.marketingCrmSettingOption.findFirst.mockResolvedValue(null);

      await expect(
        service.update(user, 'prospect-a', {
          businessTypeId: 'missing-business-type',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not revalidate unchanged archived references when explicitly submitted', async () => {
      const existing = {
        ...makeExistingProspect(),
        businessTypeId: 'archived-business-type',
        sourceTypeId: 'archived-source-type',
        pipelineStageId: 'archived-stage',
        contacts: [
          {
            ...makeExistingProspect().contacts[0],
            decisionMakerTypeId: 'archived-decision-maker',
          },
        ],
        products: [
          {
            ...makeExistingProspect().products[0],
            productId: 'archived-product',
          },
        ],
      };
      prisma.marketingProspect.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(existing);

      await service.update(user, 'prospect-a', {
        businessTypeId: 'archived-business-type',
        sourceTypeId: 'archived-source-type',
        pipelineStageId: 'archived-stage',
        primaryContact: {
          decisionMakerTypeId: 'archived-decision-maker',
        },
        products: [
          {
            id: 'product-row-1',
            productId: 'archived-product',
            expectedValue: 10000,
          },
        ],
      });

      expect(prisma.marketingCrmSettingOption.findFirst).not.toHaveBeenCalled();
      expect(prisma.marketingPipelineStage.findFirst).toHaveBeenCalledTimes(1);
    });

    it('propagates transaction failures so aggregate child updates roll back', async () => {
      const existing = makeExistingProspect();
      prisma.marketingProspect.findFirst.mockResolvedValue(existing);
      prisma.marketingProspectProduct.update.mockRejectedValue(
        new Error('child update failed'),
      );

      await expect(
        service.update(user, 'prospect-a', {
          products: [
            {
              id: 'product-row-1',
              expectedValue: 12500,
            },
          ],
        }),
      ).rejects.toThrow('child update failed');
      expect(prisma.marketingProspect.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('allows the owner to permanently delete an assigned prospect', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValueOnce({
        id: 'prospect-a',
      });

      await expect(
        service.remove(
          {
            ...user,
            permissions: [MarketingCrmSettingsPermission.PROSPECTS_DELETE],
          },
          'prospect-a',
        ),
      ).resolves.toBeUndefined();

      expect(prisma.marketingProspect.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'prospect-a',
          tenantId: 'tenant-1',
          assignedUserId: 'user-1',
        },
        select: { id: true },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.marketingProspect.delete).toHaveBeenCalledWith({
        where: { id: 'prospect-a' },
      });
      expect(prisma.marketingCrmSettingOption.findFirst).not.toHaveBeenCalled();
      expect(prisma.marketingCrmSettingOption.findMany).not.toHaveBeenCalled();
    });

    it('allows DELETE_ALL users to delete another user prospect within the same tenant', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValueOnce({
        id: 'prospect-a',
      });

      await service.remove(
        {
          ...user,
          permissions: [
            MarketingCrmSettingsPermission.PROSPECTS_DELETE,
            MarketingCrmSettingsPermission.PROSPECTS_DELETE_ALL,
          ],
        },
        'prospect-a',
      );

      expect(prisma.marketingProspect.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'prospect-a',
          tenantId: 'tenant-1',
        },
        select: { id: true },
      });
      expect(prisma.marketingProspect.delete).toHaveBeenCalledWith({
        where: { id: 'prospect-a' },
      });
    });

    it('returns non-disclosing not found for missing, cross-tenant or unassigned prospects', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.remove(
          {
            ...user,
            permissions: [MarketingCrmSettingsPermission.PROSPECTS_DELETE],
          },
          'prospect-other',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.marketingProspect.delete).not.toHaveBeenCalled();
    });

    it('uses the root prospect delete so database cascades remove contacts, products and interactions', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValueOnce({
        id: 'prospect-a',
      });

      await service.remove(
        {
          ...user,
          permissions: [MarketingCrmSettingsPermission.PROSPECTS_DELETE],
        },
        'prospect-a',
      );

      expect(prisma.marketingProspect.delete).toHaveBeenCalledWith({
        where: { id: 'prospect-a' },
      });
      expect(prisma.marketingProspectProduct.deleteMany).not.toHaveBeenCalled();
    });

    it('propagates transaction failures so the aggregate is not partially deleted', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValueOnce({
        id: 'prospect-a',
      });
      prisma.marketingProspect.delete.mockRejectedValue(
        new Error('delete failed'),
      );

      await expect(
        service.remove(
          {
            ...user,
            permissions: [MarketingCrmSettingsPermission.PROSPECTS_DELETE],
          },
          'prospect-a',
        ),
      ).rejects.toThrow('delete failed');
    });

    it('returns not found from details after a deleted prospect is absent', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValueOnce(null);

      await expect(service.findOne(user, 'prospect-a')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('excludes deleted prospects from list results once they are absent from the table', async () => {
      prisma.marketingProspect.count.mockResolvedValueOnce(0);
      prisma.marketingProspect.findMany.mockResolvedValueOnce([]);

      const result = await service.list(user, {});

      expect(result).toEqual({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
      });
    });
  });

  describe('follow-ups', () => {
    const followUpDto = (): CreateProspectFollowUpDto => ({
      dueAt: '2026-10-07T09:00:00.000Z',
      note: ' Call  Ama  about documents ',
    });

    const pendingFollowUp = {
      id: 'follow-up-1',
      tenantId: 'tenant-1',
      prospectId: 'prospect-a',
      dueAt: new Date('2026-10-07T09:00:00.000Z'),
      note: 'Call Ama about documents',
      status: MarketingProspectFollowUpStatus.PENDING,
      createdByUserId: 'user-1',
      completedByUserId: null,
      completedAt: null,
      completedInteractionId: null,
      createdAt: new Date('2026-09-30T09:00:00.000Z'),
      updatedAt: new Date('2026-09-30T09:00:00.000Z'),
    };

    it('creates one tenant-scoped pending explicit follow-up for an assigned prospect', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValueOnce({
        id: 'prospect-a',
      });
      prisma.marketingProspectFollowUp.create.mockResolvedValueOnce(
        pendingFollowUp,
      );

      const result = await service.createFollowUp(
        {
          ...user,
          permissions: [MarketingCrmSettingsPermission.FOLLOW_UPS_CREATE],
        },
        'prospect-a',
        followUpDto(),
      );

      expect(prisma.marketingProspect.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'prospect-a',
          tenantId: 'tenant-1',
          assignedUserId: 'user-1',
        },
        select: { id: true },
      });
      expect(prisma.marketingProspectFollowUp.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
          status: MarketingProspectFollowUpStatus.PENDING,
        },
        select: { id: true },
      });
      expect(prisma.marketingProspectFollowUp.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
          dueAt: new Date('2026-10-07T09:00:00.000Z'),
          note: 'Call Ama about documents',
          status: MarketingProspectFollowUpStatus.PENDING,
          createdByUserId: 'user-1',
        },
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: 'follow-up-1',
          status: MarketingProspectFollowUpStatus.PENDING,
        }),
      );
    });

    it('rejects a second pending explicit follow-up for the same prospect', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValueOnce({
        id: 'prospect-a',
      });
      prisma.marketingProspectFollowUp.findFirst.mockResolvedValueOnce({
        id: 'follow-up-existing',
      });

      await expect(
        service.createFollowUp(user, 'prospect-a', followUpDto()),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.marketingProspectFollowUp.create).not.toHaveBeenCalled();
    });

    it('returns non-disclosing not found for cross-tenant or unassigned prospect follow-up creation', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.createFollowUp(user, 'prospect-other', followUpDto()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.marketingProspectFollowUp.findFirst).not.toHaveBeenCalled();
      expect(prisma.marketingProspectFollowUp.create).not.toHaveBeenCalled();
    });

    it('lists follow-up history including cancelled and completed rows', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValueOnce({
        id: 'prospect-a',
      });
      prisma.marketingProspectFollowUp.findMany.mockResolvedValueOnce([
        {
          ...pendingFollowUp,
          status: MarketingProspectFollowUpStatus.CANCELLED,
        },
        {
          ...pendingFollowUp,
          id: 'follow-up-2',
          status: MarketingProspectFollowUpStatus.COMPLETED,
          completedByUserId: 'user-1',
          completedAt: new Date('2026-10-07T12:00:00.000Z'),
          completedInteractionId: 'interaction-1',
        },
      ]);

      const result = await service.listFollowUps(user, 'prospect-a');

      expect(prisma.marketingProspectFollowUp.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
        },
        orderBy: [{ createdAt: 'desc' }, { dueAt: 'desc' }, { id: 'asc' }],
      });
      expect(result.items.map((item) => item.status)).toEqual([
        MarketingProspectFollowUpStatus.CANCELLED,
        MarketingProspectFollowUpStatus.COMPLETED,
      ]);
    });

    it('updates due date and note only for an accessible pending follow-up', async () => {
      prisma.marketingProspectFollowUp.findFirst.mockResolvedValueOnce({
        id: 'follow-up-1',
      });
      prisma.marketingProspectFollowUp.update.mockResolvedValueOnce({
        ...pendingFollowUp,
        dueAt: new Date('2026-10-08T09:00:00.000Z'),
        note: null,
      });

      await service.updateFollowUp(user, 'follow-up-1', {
        dueAt: '2026-10-08T09:00:00.000Z',
        note: '',
      });

      expect(prisma.marketingProspectFollowUp.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'follow-up-1',
          tenantId: 'tenant-1',
          status: MarketingProspectFollowUpStatus.PENDING,
          prospect: {
            tenantId: 'tenant-1',
            assignedUserId: 'user-1',
          },
        },
        select: { id: true },
      });
      expect(prisma.marketingProspectFollowUp.update).toHaveBeenCalledWith({
        where: { id: 'follow-up-1' },
        data: {
          dueAt: new Date('2026-10-08T09:00:00.000Z'),
          note: null,
        },
      });
    });

    it('rejects empty follow-up updates and inaccessible follow-ups', async () => {
      await expect(
        service.updateFollowUp(user, 'follow-up-1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);

      prisma.marketingProspectFollowUp.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.updateFollowUp(user, 'follow-up-1', {
          dueAt: '2026-10-08T09:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('cancels pending explicit follow-ups so they remain historical but leave the worklist', async () => {
      prisma.marketingProspectFollowUp.findFirst.mockResolvedValueOnce({
        id: 'follow-up-1',
      });
      prisma.marketingProspectFollowUp.update.mockResolvedValueOnce({
        ...pendingFollowUp,
        status: MarketingProspectFollowUpStatus.CANCELLED,
      });

      const result = await service.cancelFollowUp(user, 'follow-up-1');

      expect(prisma.marketingProspectFollowUp.update).toHaveBeenCalledWith({
        where: { id: 'follow-up-1' },
        data: { status: MarketingProspectFollowUpStatus.CANCELLED },
      });
      expect(result.status).toBe(MarketingProspectFollowUpStatus.CANCELLED);
    });

    it('completes a pending follow-up by recording the required interaction atomically', async () => {
      const interaction = {
        id: 'interaction-1',
        tenantId: 'tenant-1',
        prospectId: 'prospect-a',
        interactionMediumId: '66666666-6666-4666-8666-666666666666',
        occurredAt: new Date('2026-10-01T10:30:00.000Z'),
        notes: 'Discussed final quotation',
        decisionMakerInvolved: true,
        createdByUserId: 'user-1',
        createdAt: new Date('2026-10-01T10:31:00.000Z'),
        participants: [
          {
            id: 'participant-1',
            tenantId: 'tenant-1',
            interactionId: 'interaction-1',
            fullName: 'Ama Mensah',
            phone: '+233201234567',
            role: 'Finance Director',
            createdAt: new Date('2026-10-01T10:32:00.000Z'),
          },
        ],
      };
      const completedFollowUp = {
        ...pendingFollowUp,
        status: MarketingProspectFollowUpStatus.COMPLETED,
        completedAt: new Date('2026-10-01T10:31:00.000Z'),
        completedByUserId: 'user-1',
        completedInteractionId: 'interaction-1',
      };
      prisma.marketingProspectFollowUp.findFirst
        .mockResolvedValueOnce({
          id: 'follow-up-1',
          prospectId: 'prospect-a',
          status: MarketingProspectFollowUpStatus.PENDING,
        })
        .mockResolvedValueOnce(completedFollowUp);
      prisma.marketingProspectInteraction.create.mockResolvedValueOnce(
        interaction,
      );
      prisma.marketingProspectInteraction.groupBy.mockResolvedValueOnce([
        {
          prospectId: 'prospect-a',
          _max: { occurredAt: new Date('2026-10-01T10:30:00.000Z') },
        },
      ]);
      prisma.marketingCrmSettingOption.findMany.mockResolvedValueOnce([
        {
          id: '66666666-6666-4666-8666-666666666666',
          name: 'Phone Call',
        },
      ]);

      const result = await service.completeFollowUp(user, 'follow-up-1', {
        interaction: {
          occurredAt: '2026-10-01T10:30:00.000Z',
          interactionMediumId: '66666666-6666-4666-8666-666666666666',
          notes: ' Discussed  final quotation ',
          decisionMakerInvolved: true,
          participants: [
            {
              fullName: ' Ama  Mensah ',
              phone: ' +233201234567 ',
              role: ' Finance  Director ',
            },
          ],
        },
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(
        prisma.marketingProspectFollowUp.findFirst,
      ).toHaveBeenNthCalledWith(1, {
        where: {
          id: 'follow-up-1',
          tenantId: 'tenant-1',
          prospect: {
            tenantId: 'tenant-1',
            assignedUserId: 'user-1',
          },
        },
        select: {
          id: true,
          prospectId: true,
          status: true,
        },
      });
      expect(prisma.marketingCrmSettingOption.findFirst).toHaveBeenCalledWith({
        where: {
          id: '66666666-6666-4666-8666-666666666666',
          tenantId: 'tenant-1',
          category: MarketingCrmSettingCategory.INTERACTION_MEDIUM,
          archivedAt: null,
          isActive: true,
        },
        select: { id: true },
      });
      expect(prisma.marketingProspectInteraction.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
          interactionMediumId: '66666666-6666-4666-8666-666666666666',
          occurredAt: new Date('2026-10-01T10:30:00.000Z'),
          notes: 'Discussed final quotation',
          decisionMakerInvolved: true,
          createdByUserId: 'user-1',
          participants: {
            create: [
              {
                tenantId: 'tenant-1',
                fullName: 'Ama Mensah',
                phone: '+233201234567',
                role: 'Finance Director',
              },
            ],
          },
        },
        include: {
          participants: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
      });
      expect(prisma.marketingProspectFollowUp.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'follow-up-1',
          tenantId: 'tenant-1',
          status: MarketingProspectFollowUpStatus.PENDING,
        },
        data: {
          status: MarketingProspectFollowUpStatus.COMPLETED,
          completedAt: expect.any(Date) as Date,
          completedByUserId: 'user-1',
          completedInteractionId: 'interaction-1',
        },
      });
      expect(result.followUp).toEqual(
        expect.objectContaining({
          status: MarketingProspectFollowUpStatus.COMPLETED,
          completedByUserId: 'user-1',
          completedInteractionId: 'interaction-1',
        }),
      );
      expect(result.interaction).toEqual(
        expect.objectContaining({
          id: 'interaction-1',
          interactionMedium: {
            id: '66666666-6666-4666-8666-666666666666',
            name: 'Phone Call',
          },
        }),
      );
      expect(result.nextFollowUp).toBeNull();
      expect(result.effectiveNextFollowUp).toEqual({
        source: 'DEFAULT',
        dueAt: new Date('2026-10-08T10:30:00.000Z'),
      });
    });

    it('creates the optional next explicit follow-up during completion', async () => {
      prisma.marketingProspectFollowUp.findFirst
        .mockResolvedValueOnce({
          id: 'follow-up-1',
          prospectId: 'prospect-a',
          status: MarketingProspectFollowUpStatus.PENDING,
        })
        .mockResolvedValueOnce({
          ...pendingFollowUp,
          status: MarketingProspectFollowUpStatus.COMPLETED,
          completedAt: new Date('2026-10-01T10:31:00.000Z'),
          completedByUserId: 'user-1',
          completedInteractionId: 'interaction-1',
        });
      prisma.marketingProspectInteraction.create.mockResolvedValueOnce({
        id: 'interaction-1',
        tenantId: 'tenant-1',
        prospectId: 'prospect-a',
        interactionMediumId: '66666666-6666-4666-8666-666666666666',
        occurredAt: new Date('2026-10-01T10:30:00.000Z'),
        notes: null,
        decisionMakerInvolved: false,
        createdByUserId: 'user-1',
        createdAt: new Date('2026-10-01T10:31:00.000Z'),
        participants: [],
      });
      prisma.marketingProspectFollowUp.create.mockResolvedValueOnce({
        ...pendingFollowUp,
        id: 'follow-up-next',
        dueAt: new Date('2026-10-03T09:00:00.000Z'),
        note: 'Call to confirm approval',
      });
      prisma.marketingProspectInteraction.groupBy.mockResolvedValueOnce([
        {
          prospectId: 'prospect-a',
          _max: { occurredAt: new Date('2026-10-01T10:30:00.000Z') },
        },
      ]);

      const result = await service.completeFollowUp(user, 'follow-up-1', {
        interaction: {
          occurredAt: '2026-10-01T10:30:00.000Z',
          interactionMediumId: '66666666-6666-4666-8666-666666666666',
          decisionMakerInvolved: false,
        },
        nextFollowUp: {
          dueAt: '2026-10-03T09:00:00.000Z',
          note: ' Call  to confirm approval ',
        },
      });

      expect(prisma.marketingProspectFollowUp.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          prospectId: 'prospect-a',
          dueAt: new Date('2026-10-03T09:00:00.000Z'),
          note: 'Call to confirm approval',
          status: MarketingProspectFollowUpStatus.PENDING,
          createdByUserId: 'user-1',
        },
      });
      expect(result.nextFollowUp).toEqual(
        expect.objectContaining({ id: 'follow-up-next' }),
      );
      expect(result.effectiveNextFollowUp).toEqual({
        source: 'EXPLICIT',
        dueAt: new Date('2026-10-03T09:00:00.000Z'),
      });
    });

    it('rejects inactive, archived, wrong-category or cross-tenant interaction media before completion writes', async () => {
      prisma.marketingProspectFollowUp.findFirst.mockResolvedValueOnce({
        id: 'follow-up-1',
        prospectId: 'prospect-a',
        status: MarketingProspectFollowUpStatus.PENDING,
      });
      prisma.marketingCrmSettingOption.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.completeFollowUp(user, 'follow-up-1', {
          interaction: {
            occurredAt: '2026-10-01T10:30:00.000Z',
            interactionMediumId: '66666666-6666-4666-8666-666666666666',
            decisionMakerInvolved: false,
          },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.marketingProspectInteraction.create).not.toHaveBeenCalled();
      expect(
        prisma.marketingProspectFollowUp.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('rejects duplicate, cancelled or completed follow-up completion', async () => {
      prisma.marketingProspectFollowUp.findFirst.mockResolvedValueOnce({
        id: 'follow-up-1',
        prospectId: 'prospect-a',
        status: MarketingProspectFollowUpStatus.CANCELLED,
      });

      await expect(
        service.completeFollowUp(user, 'follow-up-1', {
          interaction: {
            occurredAt: '2026-10-01T10:30:00.000Z',
            interactionMediumId: '66666666-6666-4666-8666-666666666666',
            decisionMakerInvolved: false,
          },
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.marketingProspectInteraction.create).not.toHaveBeenCalled();
    });

    it('uses tenant-wide completion scope for COMPLETE_ALL users', async () => {
      prisma.marketingProspectFollowUp.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.completeFollowUp(
          {
            ...user,
            permissions: [
              MarketingCrmSettingsPermission.FOLLOW_UPS_COMPLETE,
              MarketingCrmSettingsPermission.FOLLOW_UPS_COMPLETE_ALL,
            ],
          },
          'follow-up-1',
          {
            interaction: {
              occurredAt: '2026-10-01T10:30:00.000Z',
              interactionMediumId: '66666666-6666-4666-8666-666666666666',
              decisionMakerInvolved: false,
            },
          },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.marketingProspectFollowUp.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'follow-up-1',
            tenantId: 'tenant-1',
            prospect: {
              tenantId: 'tenant-1',
            },
          },
        }),
      );
    });

    it('rejects cross-tenant or inaccessible follow-ups without writing interaction records', async () => {
      prisma.marketingProspectFollowUp.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.completeFollowUp(user, 'follow-up-other', {
          interaction: {
            occurredAt: '2026-10-01T10:30:00.000Z',
            interactionMediumId: '66666666-6666-4666-8666-666666666666',
            decisionMakerInvolved: false,
          },
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.marketingProspectInteraction.create).not.toHaveBeenCalled();
    });

    it('rolls back completion when interaction creation fails', async () => {
      prisma.marketingProspectFollowUp.findFirst.mockResolvedValueOnce({
        id: 'follow-up-1',
        prospectId: 'prospect-a',
        status: MarketingProspectFollowUpStatus.PENDING,
      });
      prisma.marketingProspectInteraction.create.mockRejectedValueOnce(
        new Error('interaction failed'),
      );

      await expect(
        service.completeFollowUp(user, 'follow-up-1', {
          interaction: {
            occurredAt: '2026-10-01T10:30:00.000Z',
            interactionMediumId: '66666666-6666-4666-8666-666666666666',
            decisionMakerInvolved: false,
          },
        }),
      ).rejects.toThrow('interaction failed');
      expect(
        prisma.marketingProspectFollowUp.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('rejects concurrent double completion when the pending update no longer matches', async () => {
      prisma.marketingProspectFollowUp.findFirst.mockResolvedValueOnce({
        id: 'follow-up-1',
        prospectId: 'prospect-a',
        status: MarketingProspectFollowUpStatus.PENDING,
      });
      prisma.marketingProspectInteraction.create.mockResolvedValueOnce({
        id: 'interaction-1',
        tenantId: 'tenant-1',
        prospectId: 'prospect-a',
        interactionMediumId: '66666666-6666-4666-8666-666666666666',
        occurredAt: new Date('2026-10-01T10:30:00.000Z'),
        notes: null,
        decisionMakerInvolved: false,
        createdByUserId: 'user-1',
        createdAt: new Date('2026-10-01T10:31:00.000Z'),
        participants: [],
      });
      prisma.marketingProspectFollowUp.updateMany.mockResolvedValueOnce({
        count: 0,
      });

      await expect(
        service.completeFollowUp(user, 'follow-up-1', {
          interaction: {
            occurredAt: '2026-10-01T10:30:00.000Z',
            interactionMediumId: '66666666-6666-4666-8666-666666666666',
            decisionMakerInvolved: false,
          },
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('uses the max interaction occurredAt for default follow-up after backdated completion', async () => {
      prisma.marketingProspectFollowUp.findFirst
        .mockResolvedValueOnce({
          id: 'follow-up-1',
          prospectId: 'prospect-a',
          status: MarketingProspectFollowUpStatus.PENDING,
        })
        .mockResolvedValueOnce({
          ...pendingFollowUp,
          status: MarketingProspectFollowUpStatus.COMPLETED,
          completedAt: new Date('2026-10-01T10:31:00.000Z'),
          completedByUserId: 'user-1',
          completedInteractionId: 'interaction-1',
        });
      prisma.marketingProspectInteraction.create.mockResolvedValueOnce({
        id: 'interaction-1',
        tenantId: 'tenant-1',
        prospectId: 'prospect-a',
        interactionMediumId: '66666666-6666-4666-8666-666666666666',
        occurredAt: new Date('2026-09-20T10:30:00.000Z'),
        notes: null,
        decisionMakerInvolved: false,
        createdByUserId: 'user-1',
        createdAt: new Date('2026-10-01T10:31:00.000Z'),
        participants: [],
      });
      prisma.marketingProspectInteraction.groupBy.mockResolvedValueOnce([
        {
          prospectId: 'prospect-a',
          _max: { occurredAt: new Date('2026-09-30T10:00:00.000Z') },
        },
      ]);

      const result = await service.completeFollowUp(user, 'follow-up-1', {
        interaction: {
          occurredAt: '2026-09-20T10:30:00.000Z',
          interactionMediumId: '66666666-6666-4666-8666-666666666666',
          decisionMakerInvolved: false,
        },
      });

      expect(result.effectiveNextFollowUp).toEqual({
        source: 'DEFAULT',
        dueAt: new Date('2026-10-07T10:00:00.000Z'),
      });
    });

    it('uses explicit pending follow-ups before default latest-interaction plus seven days in the worklist', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-01T00:00:00.000Z'));
      prisma.marketingProspect.findMany.mockResolvedValueOnce([
        {
          id: 'prospect-explicit',
          companyName: 'Beta Limited',
          assignedUserId: 'user-1',
        },
        {
          id: 'prospect-default',
          companyName: 'Acme Manufacturing',
          assignedUserId: 'user-1',
        },
      ]);
      prisma.marketingProspectFollowUp.findMany.mockResolvedValueOnce([
        {
          ...pendingFollowUp,
          id: 'follow-up-explicit',
          prospectId: 'prospect-explicit',
          dueAt: new Date('2026-10-03T09:00:00.000Z'),
        },
      ]);
      prisma.marketingProspectInteraction.groupBy.mockResolvedValueOnce([
        {
          prospectId: 'prospect-explicit',
          _max: { occurredAt: new Date('2026-09-29T10:00:00.000Z') },
        },
        {
          prospectId: 'prospect-default',
          _max: { occurredAt: new Date('2026-09-30T10:00:00.000Z') },
        },
      ]);

      const result = await service.listFollowUpWorklist(user);

      expect(prisma.marketingProspect.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          assignedUserId: 'user-1',
        },
        select: {
          id: true,
          companyName: true,
          assignedUserId: true,
        },
        orderBy: [{ companyName: 'asc' }, { id: 'asc' }],
      });
      expect(result.items).toEqual([
        expect.objectContaining({
          prospectId: 'prospect-explicit',
          followUpId: 'follow-up-explicit',
          dueAt: new Date('2026-10-03T09:00:00.000Z'),
          followUpSource: 'EXPLICIT',
          urgency: 'UPCOMING',
          lastInteractionDate: new Date('2026-09-29T10:00:00.000Z'),
        }),
        expect.objectContaining({
          prospectId: 'prospect-default',
          followUpId: null,
          dueAt: new Date('2026-10-07T10:00:00.000Z'),
          followUpSource: 'DEFAULT',
          urgency: 'UPCOMING',
          lastInteractionDate: new Date('2026-09-30T10:00:00.000Z'),
        }),
      ]);
      jest.useRealTimers();
    });

    it('returns tenant-wide follow-up worklist rows for users with FOLLOW_UPS_VIEW_ALL', async () => {
      prisma.marketingProspect.findMany.mockResolvedValueOnce([]);

      await service.listFollowUpWorklist({
        ...user,
        permissions: [
          MarketingCrmSettingsPermission.FOLLOW_UPS_VIEW,
          MarketingCrmSettingsPermission.FOLLOW_UPS_VIEW_ALL,
        ],
      });

      expect(prisma.marketingProspect.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
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

    it('filters by sales pipeline stage', async () => {
      await service.list(user, {
        pipelineStageId: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
      });

      expect(prisma.marketingProspect.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            pipelineStageId: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
          }),
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

  describe('UpdateProspectDto validation', () => {
    async function validateDto(payload: unknown) {
      return validate(plainToInstance(UpdateProspectDto, payload));
    }

    it('allows sparse valid patches', async () => {
      const errors = await validateDto({
        primaryContact: {
          email: 'ama@example.com',
        },
        products: [
          {
            id: '77777777-7777-4777-8777-777777777777',
            expectedValue: 12000,
            expectedCloseDate: null,
          },
        ],
      });

      expect(errors).toEqual([]);
    });

    it('validates changed UUIDs, email format, product money fields and dates', async () => {
      const errors = await validateDto({
        businessTypeId: 'not-a-uuid',
        primaryContact: {
          email: 'not-an-email',
        },
        products: [
          {
            productId: 'not-a-uuid',
            expectedValue: -1,
            expectedCloseDate: 'not-a-date',
          },
        ],
      });
      const properties = errors.map((error) => error.property);

      expect(properties).toEqual(
        expect.arrayContaining([
          'businessTypeId',
          'primaryContact',
          'products',
        ]),
      );
    });

    it('rejects empty product arrays when product replacement is submitted', async () => {
      const errors = await validateDto({ products: [] });

      expect(errors.some((error) => error.property === 'products')).toBe(true);
    });
  });

  describe('CreateProspectInteractionDto validation', () => {
    async function validateDto(payload: unknown) {
      return validate(plainToInstance(CreateProspectInteractionDto, payload));
    }

    it('requires occurredAt, interactionMediumId and decisionMakerInvolved', async () => {
      const errors = await validateDto({});

      expect(errors.map((error) => error.property)).toEqual(
        expect.arrayContaining([
          'occurredAt',
          'interactionMediumId',
          'decisionMakerInvolved',
        ]),
      );
    });

    it('validates participant details when participants are supplied', async () => {
      const errors = await validateDto({
        occurredAt: '2026-09-30T10:30:00.000Z',
        interactionMediumId: '66666666-6666-4666-8666-666666666666',
        decisionMakerInvolved: false,
        participants: [
          {
            fullName: '',
            phone: '',
            role: '',
          },
        ],
      });

      expect(errors.some((error) => error.property === 'participants')).toBe(
        true,
      );
    });
  });

  describe('ProspectFollowUpDto validation', () => {
    it('requires a valid ISO due date when creating follow-ups', async () => {
      const errors = await validate(
        plainToInstance(CreateProspectFollowUpDto, {
          dueAt: 'not-a-date',
          note: 'Call client',
        }),
      );

      expect(errors.map((error) => error.property)).toContain('dueAt');
    });

    it('allows sparse valid follow-up updates', async () => {
      const errors = await validate(
        plainToInstance(UpdateProspectFollowUpDto, {
          dueAt: '2026-10-08T09:00:00.000Z',
          note: 'Updated follow-up note',
        }),
      );

      expect(errors).toEqual([]);
    });
  });
});
