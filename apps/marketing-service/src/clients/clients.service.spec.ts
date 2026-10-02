/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingClientProductStatus,
  Prisma,
} from '../../prisma/generated/client';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { PrismaService } from '../prisma/prisma.service';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';

describe('ClientsService', () => {
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

  const uniqueError = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

  const clientRecord = {
    id: 'client-1',
    tenantId: 'tenant-1',
    companyName: 'Acme Manufacturing',
    normalizedCompanyName: 'acme manufacturing',
    businessTypeId: null,
    sourceTypeId: null,
    assignedUserId: 'user-1',
    locationLabel: 'Accra, Ghana',
    latitude: new Prisma.Decimal('5.6037'),
    longitude: new Prisma.Decimal('-0.187'),
    isBillable: false,
    convertedFromProspectId: null,
    convertedAt: null,
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    updatedAt: new Date('2026-10-01T10:00:00.000Z'),
    contacts: [],
    products: [],
    interactions: [],
  };

  const makeDto = (): CreateClientDto => ({
    companyName: '  Acme   Manufacturing ',
    primaryContact: { name: ' Ama  Mensah ', phone: ' +233201234567 ' },
    productIds: [
      '55555555-5555-4555-8555-555555555555',
      '66666666-6666-4666-8666-666666666666',
    ],
    location: { label: 'Accra, Ghana', latitude: 5.6037, longitude: -0.187 },
    isBillable: true,
  });

  const makePrisma = () => {
    const tx = {
      marketingClient: {
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      marketingClientContact: { create: jest.fn(), update: jest.fn() },
      marketingProspectInteraction: {
        deleteMany: jest.fn(),
        updateMany: jest.fn(),
      },
      marketingProspectFollowUp: {
        deleteMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    return {
      tx,
      marketingClient: {
        ...tx.marketingClient,
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      marketingClientProduct: { create: jest.fn() },
      marketingProspectInteraction: { create: jest.fn() },
      marketingProspect: { findFirst: jest.fn() },
      marketingPipelineStage: { findFirst: jest.fn() },
      marketingCrmSettingOption: { findFirst: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(
        (input: Array<Promise<unknown>> | ((t: typeof tx) => unknown)) => {
          if (Array.isArray(input)) return Promise.all(input);
          return Promise.resolve(input(tx));
        },
      ),
    };
  };

  let prisma: ReturnType<typeof makePrisma>;
  let service: ClientsService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.marketingClient.count.mockResolvedValue(0);
    prisma.marketingClient.findMany.mockResolvedValue([]);
    prisma.marketingClient.findFirst.mockResolvedValue(null);
    prisma.marketingCrmSettingOption.findFirst.mockResolvedValue({ id: 's' });
    prisma.marketingCrmSettingOption.findMany.mockResolvedValue([]);
    prisma.tx.marketingClient.create.mockResolvedValue({ id: 'client-1' });
    prisma.tx.marketingProspectInteraction.updateMany.mockResolvedValue({
      count: 2,
    });
    prisma.tx.marketingProspectFollowUp.updateMany.mockResolvedValue({
      count: 1,
    });
    service = new ClientsService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('limits users without VIEW_ALL to their assigned clients and ignores the assignee filter', async () => {
      await service.list(user, {
        search: '  ACME   Ltd ',
        assignedUserId: 'x',
      });

      expect(prisma.marketingClient.count).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          assignedUserId: 'user-1',
          normalizedCompanyName: { contains: 'acme ltd' },
        },
      });
    });

    it('lets VIEW_ALL users list the tenant and filter by assignee', async () => {
      await service.list(
        {
          ...user,
          permissions: [MarketingCrmSettingsPermission.CLIENTS_VIEW_ALL],
        },
        { assignedUserId: 'user-2' },
      );

      expect(prisma.marketingClient.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', assignedUserId: 'user-2' },
      });
    });

    it('returns names for the business type, decision maker and products', async () => {
      prisma.marketingClient.count.mockResolvedValue(1);
      prisma.marketingClient.findMany.mockResolvedValue([
        {
          ...clientRecord,
          businessTypeId: 'bt-1',
          contacts: [
            {
              name: 'Ama Mensah',
              phone: '+233201234567',
              email: 'ama@example.com',
              decisionMakerTypeId: 'dm-1',
            },
          ],
          products: [
            { productId: 'p-1', status: MarketingClientProductStatus.PENDING },
          ],
        },
      ]);
      prisma.marketingCrmSettingOption.findMany.mockResolvedValue([
        { id: 'bt-1', name: 'Enterprise' },
        { id: 'dm-1', name: 'CEO' },
        { id: 'p-1', name: 'Fire Cover' },
      ]);

      const result = await service.list(user);

      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.data[0]).toMatchObject({
        id: 'client-1',
        businessType: { id: 'bt-1', name: 'Enterprise' },
        primaryContact: {
          name: 'Ama Mensah',
          email: 'ama@example.com',
          decisionMaker: { id: 'dm-1', name: 'CEO' },
        },
        products: [{ id: 'p-1', name: 'Fire Cover', status: 'PENDING' }],
      });
    });
  });

  describe('create', () => {
    it('rejects the same product listed twice', async () => {
      const dto = makeDto();
      dto.productIds = [dto.productIds[0], dto.productIds[0]];

      await expect(service.create(user, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.marketingClient.create).not.toHaveBeenCalled();
    });

    it('rejects references that are not active tenant settings', async () => {
      prisma.marketingCrmSettingOption.findFirst.mockResolvedValue(null);

      await expect(service.create(user, makeDto())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.marketingClient.create).not.toHaveBeenCalled();
    });

    it('creates a tenant-scoped client assigned to the creator with PENDING products', async () => {
      prisma.marketingClient.findFirst.mockResolvedValue(clientRecord);

      await service.create(user, makeDto());

      const arg = prisma.marketingClient.create.mock.calls[0][0];
      expect(arg.data).toMatchObject({
        tenantId: 'tenant-1',
        companyName: 'Acme Manufacturing',
        normalizedCompanyName: 'acme manufacturing',
        assignedUserId: 'user-1',
        isBillable: true,
      });
      expect(arg.data.contacts.create).toMatchObject({
        tenantId: 'tenant-1',
        name: 'Ama Mensah',
        phone: '+233201234567',
        isPrimary: true,
      });
      expect(arg.data.products.create).toEqual([
        {
          tenantId: 'tenant-1',
          productId: '55555555-5555-4555-8555-555555555555',
        },
        {
          tenantId: 'tenant-1',
          productId: '66666666-6666-4666-8666-666666666666',
        },
      ]);
    });
  });

  describe('findOne', () => {
    it('returns non-disclosing not found for clients the user cannot see', async () => {
      await expect(service.findOne(user, 'client-9')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.marketingClient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'client-9',
            tenantId: 'tenant-1',
            assignedUserId: 'user-1',
          },
        }),
      );
    });
  });

  describe('update', () => {
    const existing = {
      id: 'client-1',
      contacts: [{ id: 'contact-1' }],
    };

    beforeEach(() => {
      prisma.marketingClient.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValue(clientRecord);
    });

    it('rejects an empty patch', async () => {
      await expect(service.update(user, 'client-1', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('returns not found for clients the user cannot edit', async () => {
      prisma.marketingClient.findFirst.mockReset();
      prisma.marketingClient.findFirst.mockResolvedValue(null);

      await expect(
        service.update(user, 'client-1', { isBillable: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('updates company fields, normalising the name', async () => {
      await service.update(user, 'client-1', {
        companyName: '  New   Name ',
        isBillable: true,
        businessTypeId: null,
      });

      expect(prisma.tx.marketingClient.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: {
          updatedByUserId: 'user-1',
          companyName: 'New Name',
          normalizedCompanyName: 'new name',
          businessTypeId: null,
          isBillable: true,
        },
      });
    });

    it('updates the primary contact and clears the role when null', async () => {
      await service.update(user, 'client-1', {
        primaryContact: { name: ' Kojo  Mensah ', decisionMakerTypeId: null },
      });

      expect(prisma.tx.marketingClientContact.update).toHaveBeenCalledWith({
        where: { id: 'contact-1' },
        data: { name: 'Kojo Mensah', decisionMakerTypeId: null },
      });
    });

    it('updates the location', async () => {
      await service.update(user, 'client-1', {
        location: { label: 'Kumasi, Ghana', latitude: 6.69, longitude: -1.62 },
      });

      expect(prisma.tx.marketingClient.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: {
          updatedByUserId: 'user-1',
          locationLabel: 'Kumasi, Ghana',
          latitude: 6.69,
          longitude: -1.62,
        },
      });
    });
  });

  describe('createInteraction', () => {
    const dto = {
      occurredAt: '2026-10-02T09:00:00.000Z',
      interactionMediumId: '77777777-7777-4777-8777-777777777777',
      decisionMakerInvolved: true,
      notes: '  Renewal   chat ',
      participants: [
        { fullName: ' Ama  Mensah ', phone: '+233201234567', role: 'CFO' },
      ],
    };

    beforeEach(() => {
      prisma.marketingProspectInteraction.create.mockResolvedValue({
        id: 'interaction-1',
        occurredAt: new Date(dto.occurredAt),
        interactionMediumId: dto.interactionMediumId,
        notes: 'Renewal chat',
        decisionMakerInvolved: true,
        createdByUserId: 'user-1',
        createdAt: new Date('2026-10-02T09:05:00.000Z'),
        participants: [],
      });
    });

    it('rejects completing a scheduled follow-up through this endpoint', async () => {
      await expect(
        service.createInteraction(user, 'client-1', {
          ...dto,
          followUpId: '88888888-8888-4888-8888-888888888888',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns not found when the client is not accessible', async () => {
      await expect(
        service.createInteraction(user, 'client-1', dto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.marketingProspectInteraction.create).not.toHaveBeenCalled();
    });

    it('lets users with CREATE_ALL record against any client in the tenant', async () => {
      prisma.marketingClient.findFirst.mockResolvedValue({ id: 'client-1' });

      await service.createInteraction(
        {
          ...user,
          permissions: [
            MarketingCrmSettingsPermission.PROSPECT_INTERACTIONS_CREATE_ALL,
          ],
        },
        'client-1',
        dto,
      );

      expect(prisma.marketingClient.findFirst).toHaveBeenCalledWith({
        where: { id: 'client-1', tenantId: 'tenant-1' },
        select: { id: true },
      });
    });

    it('records the interaction against the client only', async () => {
      prisma.marketingClient.findFirst.mockResolvedValue({ id: 'client-1' });
      prisma.marketingCrmSettingOption.findMany.mockResolvedValue([
        { id: dto.interactionMediumId, name: 'Phone Call' },
      ]);

      const result = await service.createInteraction(user, 'client-1', dto);

      const arg = prisma.marketingProspectInteraction.create.mock.calls[0][0];
      expect(arg.data).toMatchObject({
        tenantId: 'tenant-1',
        clientId: 'client-1',
        interactionMediumId: dto.interactionMediumId,
        notes: 'Renewal chat',
        decisionMakerInvolved: true,
        createdByUserId: 'user-1',
      });
      expect(arg.data.prospectId).toBeUndefined();
      expect(arg.data.participants.create).toEqual([
        {
          tenantId: 'tenant-1',
          fullName: 'Ama Mensah',
          phone: '+233201234567',
          role: 'CFO',
        },
      ]);
      expect(result.interactionMedium).toEqual({
        id: dto.interactionMediumId,
        name: 'Phone Call',
      });
    });
  });

  describe('addProduct', () => {
    it('returns not found when the client is not accessible', async () => {
      await expect(
        service.addProduct(user, 'client-1', { productId: 'p-1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.marketingClientProduct.create).not.toHaveBeenCalled();
    });

    it('adds the product as PENDING', async () => {
      prisma.marketingClient.findFirst.mockResolvedValue({ id: 'client-1' });
      prisma.marketingClientProduct.create.mockResolvedValue({
        id: 'cp-1',
        productId: 'p-1',
        status: MarketingClientProductStatus.PENDING,
        createdAt: new Date('2026-10-02T10:00:00.000Z'),
      });
      prisma.marketingCrmSettingOption.findMany.mockResolvedValue([
        { id: 'p-1', name: 'Fire Cover' },
      ]);

      const result = await service.addProduct(user, 'client-1', {
        productId: 'p-1',
      });

      expect(prisma.marketingClientProduct.create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-1', clientId: 'client-1', productId: 'p-1' },
      });
      expect(result).toMatchObject({
        id: 'cp-1',
        product: { id: 'p-1', name: 'Fire Cover' },
        status: 'PENDING',
      });
    });

    it('conflicts when the client already has the product', async () => {
      prisma.marketingClient.findFirst.mockResolvedValue({ id: 'client-1' });
      prisma.marketingClientProduct.create.mockRejectedValue(uniqueError());

      await expect(
        service.addProduct(user, 'client-1', { productId: 'p-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    it('removes client-only history, then the client', async () => {
      prisma.marketingClient.findFirst.mockResolvedValue({ id: 'client-1' });

      await service.remove(user, 'client-1');

      expect(
        prisma.tx.marketingProspectInteraction.deleteMany,
      ).toHaveBeenCalledWith({
        where: { clientId: 'client-1', prospectId: null },
      });
      expect(
        prisma.tx.marketingProspectFollowUp.deleteMany,
      ).toHaveBeenCalledWith({
        where: { clientId: 'client-1', prospectId: null },
      });
      expect(prisma.tx.marketingClient.delete).toHaveBeenCalledWith({
        where: { id: 'client-1' },
      });
    });

    it('returns not found for clients the user cannot delete', async () => {
      await expect(service.remove(user, 'client-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('convertProspect', () => {
    const prospect = {
      id: 'prospect-1',
      tenantId: 'tenant-1',
      companyName: 'Acme Manufacturing',
      normalizedCompanyName: 'acme manufacturing',
      businessTypeId: 'bt-1',
      sourceTypeId: 'st-1',
      pipelineStageId: 'stage-won',
      assignedUserId: 'user-1',
      locationLabel: 'Accra, Ghana',
      latitude: new Prisma.Decimal('5.6037'),
      longitude: new Prisma.Decimal('-0.187'),
      contacts: [
        {
          name: 'Ama Mensah',
          phone: '+233201234567',
          email: 'ama@example.com',
          decisionMakerTypeId: 'dm-1',
          isPrimary: true,
        },
      ],
      products: [
        {
          productId: 'p-1',
          expectedValue: new Prisma.Decimal('10000'),
          achievedValue: new Prisma.Decimal('2500'),
          commissionRate: new Prisma.Decimal('10'),
          commissionAmount: new Prisma.Decimal('999'),
        },
        {
          productId: 'p-2',
          expectedValue: new Prisma.Decimal('500'),
          achievedValue: null,
          commissionRate: null,
          commissionAmount: new Prisma.Decimal('25'),
        },
      ],
      client: null,
    };

    beforeEach(() => {
      prisma.marketingProspect.findFirst.mockResolvedValue(prospect);
      prisma.marketingPipelineStage.findFirst.mockResolvedValue({
        probability: 100,
      });
      prisma.marketingClient.findFirst.mockResolvedValue({
        ...clientRecord,
        convertedFromProspectId: 'prospect-1',
      });
    });

    it('only finds the prospect among the user own prospects without EDIT_ALL', async () => {
      await service.convertProspect(user, 'prospect-1', {});

      expect(prisma.marketingProspect.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'prospect-1',
            tenantId: 'tenant-1',
            assignedUserId: 'user-1',
          },
        }),
      );
    });

    it('lets EDIT_ALL users convert any prospect in the tenant', async () => {
      await service.convertProspect(
        {
          ...user,
          permissions: [MarketingCrmSettingsPermission.PROSPECTS_EDIT_ALL],
        },
        'prospect-1',
        {},
      );

      expect(prisma.marketingProspect.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prospect-1', tenantId: 'tenant-1' },
        }),
      );
    });

    it('returns not found when the prospect is not accessible', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValue(null);

      await expect(
        service.convertProspect(user, 'prospect-1', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('conflicts when the prospect was already converted', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValue({
        ...prospect,
        client: { id: 'client-1' },
      });

      await expect(
        service.convertProspect(user, 'prospect-1', {}),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects prospects below 100% progress', async () => {
      prisma.marketingPipelineStage.findFirst.mockResolvedValue({
        probability: 80,
      });

      await expect(
        service.convertProspect(user, 'prospect-1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('copies the prospect, carries products over as PENDING and shares its history', async () => {
      await service.convertProspect(user, 'prospect-1', { isBillable: true });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const arg = prisma.tx.marketingClient.create.mock.calls[0][0];
      expect(arg.data).toMatchObject({
        tenantId: 'tenant-1',
        companyName: 'Acme Manufacturing',
        businessTypeId: 'bt-1',
        sourceTypeId: 'st-1',
        assignedUserId: 'user-1',
        isBillable: true,
        convertedFromProspectId: 'prospect-1',
        convertedByUserId: 'user-1',
      });
      expect(arg.data.contacts.create).toEqual([
        {
          tenantId: 'tenant-1',
          name: 'Ama Mensah',
          phone: '+233201234567',
          email: 'ama@example.com',
          decisionMakerTypeId: 'dm-1',
          isPrimary: true,
        },
      ]);
      expect(arg.data.products.create).toEqual([
        {
          tenantId: 'tenant-1',
          productId: 'p-1',
          status: MarketingClientProductStatus.PENDING,
          expectedValue: new Prisma.Decimal('10000'),
          commissionRate: new Prisma.Decimal('10'),
          // Rate share of the expected value, not the stored amount or the achieved value.
          commissionAmount: new Prisma.Decimal('1000'),
        },
        {
          tenantId: 'tenant-1',
          productId: 'p-2',
          status: MarketingClientProductStatus.PENDING,
          expectedValue: new Prisma.Decimal('500'),
          commissionRate: null,
          // No rate to derive from, so the stored amount is kept.
          commissionAmount: new Prisma.Decimal('25'),
        },
      ]);
      expect(JSON.stringify(arg.data.products)).not.toContain('achieved');
      expect(
        prisma.tx.marketingProspectInteraction.updateMany,
      ).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', prospectId: 'prospect-1' },
        data: { clientId: 'client-1' },
      });
      expect(
        prisma.tx.marketingProspectFollowUp.updateMany,
      ).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', prospectId: 'prospect-1' },
        data: { clientId: 'client-1' },
      });
    });

    it('reports a concurrent conversion as already converted', async () => {
      prisma.tx.marketingClient.create.mockRejectedValue(uniqueError());

      await expect(
        service.convertProspect(user, 'prospect-1', {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
