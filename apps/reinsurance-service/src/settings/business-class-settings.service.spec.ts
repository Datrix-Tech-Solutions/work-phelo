import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  BusinessClassFieldSection,
  BusinessClassFieldType,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessClassSettingsService } from './business-class-settings.service';

describe('BusinessClassSettingsService', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  const user: RequestUser = {
    id: 'user-1',
    email: 'admin@example.com',
    role: 'TENANT_ADMIN',
    tenantId: 'tenant-1',
    tenantSlug: 'demo',
    tenantName: 'Demo',
    firstName: 'Ama',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: ['operations.reinsurance.settings:VIEW'],
  };

  const businessClass = {
    id: 'bc-1',
    tenantId: 'tenant-1',
    name: 'Motor',
    code: 'MOTOR',
    description: null,
    isActive: true,
    displayOrder: 0,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    archivedAt: null,
    createdAt: new Date('2026-05-29T10:00:00.000Z'),
    updatedAt: new Date('2026-05-29T10:00:00.000Z'),
    fields: [],
  };

  const field = {
    id: 'field-1',
    tenantId: 'tenant-1',
    businessClassId: 'bc-1',
    section: BusinessClassFieldSection.BUSINESS_DETAILS,
    fieldKey: 'vehicle_make',
    label: 'Vehicle Make',
    fieldType: BusinessClassFieldType.TEXT,
    required: true,
    options: null,
    validationRules: null,
    placeholder: null,
    helpText: null,
    displayOrder: 0,
    isActive: true,
    createdAt: new Date('2026-05-29T10:00:00.000Z'),
    updatedAt: new Date('2026-05-29T10:00:00.000Z'),
  };

  let prisma: {
    businessClass: {
      findMany: PrismaMethod;
      count: PrismaMethod;
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    businessClassField: {
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
      delete: PrismaMethod;
    };
    placement: {
      count: PrismaMethod;
    };
  };
  let service: BusinessClassSettingsService;

  beforeEach(() => {
    prisma = {
      businessClass: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      businessClassField: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
        delete: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placement: {
        count: jest.fn<Promise<unknown>, [unknown]>(),
      },
    };
    service = new BusinessClassSettingsService(
      prisma as unknown as PrismaService,
    );
  });

  it('lists only active non-archived records in the current tenant with paging', async () => {
    prisma.businessClass.findMany.mockResolvedValue([businessClass]);
    prisma.businessClass.count.mockResolvedValue(1);

    const result = await service.findAll('tenant-1', { page: 2, limit: 5 });

    expect(prisma.businessClass.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { tenantId: 'tenant-1', archivedAt: null },
      skip: 5,
      take: 5,
    });
    expect(result.meta).toEqual({ page: 2, limit: 5, total: 1, totalPages: 1 });
  });

  it('filters by isActive when provided', async () => {
    prisma.businessClass.findMany.mockResolvedValue([]);
    prisma.businessClass.count.mockResolvedValue(0);

    await service.findAll('tenant-1', { isActive: false });

    expect(prisma.businessClass.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { tenantId: 'tenant-1', archivedAt: null, isActive: false },
    });
  });

  it('does not expose another tenant record by id', async () => {
    prisma.businessClass.findFirst.mockResolvedValue(null);

    await expect(service.findOne('tenant-1', 'bc-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.businessClass.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bc-1', tenantId: 'tenant-1', archivedAt: null },
      }),
    );
  });

  it('creates a business class with uppercased code', async () => {
    prisma.businessClass.create.mockResolvedValue(businessClass);

    await service.create(user, {
      name: 'Motor',
      code: 'MOTOR',
      isActive: true,
      displayOrder: 0,
    });

    expect(prisma.businessClass.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        tenantId: 'tenant-1',
        name: 'Motor',
        code: 'MOTOR',
        isActive: true,
        displayOrder: 0,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
      },
    });
  });

  it('throws ConflictException when code already exists for tenant', async () => {
    const { Prisma } = await import('../../prisma/generated/client');
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint',
      {
        code: 'P2002',
        clientVersion: '5.x',
      },
    );
    prisma.businessClass.create.mockRejectedValue(p2002);

    await expect(
      service.create(user, { name: 'Motor', code: 'MOTOR' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects empty update payload', async () => {
    await expect(service.update(user, 'bc-1', {})).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.businessClass.update).not.toHaveBeenCalled();
  });

  it('updates only the supplied fields', async () => {
    prisma.businessClass.findFirst.mockResolvedValue(businessClass);
    prisma.businessClass.update.mockResolvedValue({
      ...businessClass,
      name: 'Motor Insurance',
    });

    await service.update(user, 'bc-1', { name: 'Motor Insurance' });

    const updateCall = prisma.businessClass.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data).toMatchObject({
      name: 'Motor Insurance',
      updatedByUserId: 'user-1',
    });
    expect(updateCall.data).not.toHaveProperty('isActive');
  });

  it('refuses to archive when active placements reference the code', async () => {
    prisma.businessClass.findFirst.mockResolvedValue(businessClass);
    prisma.placement.count.mockResolvedValue(3);

    await expect(service.archive(user, 'bc-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.businessClass.update).not.toHaveBeenCalled();
  });

  it('soft-archives when no active placements reference the code', async () => {
    prisma.businessClass.findFirst.mockResolvedValue(businessClass);
    prisma.placement.count.mockResolvedValue(0);
    prisma.businessClass.update.mockResolvedValue({
      ...businessClass,
      archivedAt: new Date(),
    });

    await service.archive(user, 'bc-1');

    const updateArg = prisma.businessClass.update.mock.calls[0]?.[0] as {
      data: { archivedAt: unknown; updatedByUserId: string };
    };
    expect(updateArg.data.updatedByUserId).toBe('user-1');
    expect(updateArg.data.archivedAt).toBeInstanceOf(Date);
  });

  it('rejects a SELECT field created without options', async () => {
    prisma.businessClass.findFirst.mockResolvedValue(businessClass);

    await expect(
      service.createField(user, 'bc-1', {
        section: BusinessClassFieldSection.BUSINESS_DETAILS,
        fieldKey: 'coverage',
        label: 'Coverage Type',
        fieldType: BusinessClassFieldType.SELECT,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.businessClassField.create).not.toHaveBeenCalled();
  });

  it('creates a TEXT field correctly', async () => {
    prisma.businessClass.findFirst.mockResolvedValue(businessClass);
    prisma.businessClassField.create.mockResolvedValue(field);

    await service.createField(user, 'bc-1', {
      section: BusinessClassFieldSection.BUSINESS_DETAILS,
      fieldKey: 'vehicle_make',
      label: 'Vehicle Make',
      fieldType: BusinessClassFieldType.TEXT,
      required: true,
    });

    expect(prisma.businessClassField.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        tenantId: 'tenant-1',
        businessClassId: 'bc-1',
        section: BusinessClassFieldSection.BUSINESS_DETAILS,
        fieldKey: 'vehicle_make',
        label: 'Vehicle Make',
        fieldType: BusinessClassFieldType.TEXT,
        required: true,
      },
    });
  });

  it('throws ConflictException on duplicate fieldKey within a section', async () => {
    const { Prisma } = await import('../../prisma/generated/client');
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint',
      {
        code: 'P2002',
        clientVersion: '5.x',
      },
    );
    prisma.businessClass.findFirst.mockResolvedValue(businessClass);
    prisma.businessClassField.create.mockRejectedValue(p2002);

    await expect(
      service.createField(user, 'bc-1', {
        section: BusinessClassFieldSection.BUSINESS_DETAILS,
        fieldKey: 'vehicle_make',
        label: 'Vehicle Make',
        fieldType: BusinessClassFieldType.TEXT,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects empty field update payload', async () => {
    await expect(
      service.updateField(user, 'bc-1', 'field-1', {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('deletes a field after verifying tenant ownership', async () => {
    prisma.businessClassField.findFirst.mockResolvedValue(field);
    prisma.businessClassField.delete.mockResolvedValue(field);

    await service.deleteField(user, 'bc-1', 'field-1');

    expect(prisma.businessClassField.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'field-1',
          tenantId: 'tenant-1',
          businessClassId: 'bc-1',
        },
      }),
    );
    expect(prisma.businessClassField.delete).toHaveBeenCalledWith({
      where: { id: 'field-1' },
    });
  });

  it('throws NotFoundException when deleting a field from another tenant', async () => {
    prisma.businessClassField.findFirst.mockResolvedValue(null);

    await expect(service.deleteField(user, 'bc-1', 'field-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.businessClassField.delete).not.toHaveBeenCalled();
  });

  it('returns form schema split by section with only active fields', async () => {
    const offerField = {
      ...field,
      id: 'field-2',
      section: BusinessClassFieldSection.OFFER_DETAILS,
      fieldKey: 'coverage_type',
      label: 'Coverage Type',
      fieldType: BusinessClassFieldType.SELECT,
      options: ['comprehensive', 'third_party'],
    };
    const inactiveField = {
      ...field,
      id: 'field-3',
      fieldKey: 'old_field',
      isActive: false,
    };

    prisma.businessClass.findFirst.mockResolvedValue({
      ...businessClass,
      fields: [field, offerField, inactiveField],
    });

    const schema = await service.getFormSchema('tenant-1', 'bc-1');

    expect(schema.businessDetails).toHaveLength(1);
    expect(schema.businessDetails[0]).toMatchObject({
      fieldKey: 'vehicle_make',
    });
    expect(schema.offerDetails).toHaveLength(1);
    expect(schema.offerDetails[0]).toMatchObject({ fieldKey: 'coverage_type' });
  });
});
