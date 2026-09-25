/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePipelineStageDto } from './dto/pipeline-stage.dto';
import { PipelineStagesService } from './pipeline-stages.service';

describe('PipelineStagesService', () => {
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
    marketingPipelineStage: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  });

  let prisma: ReturnType<typeof makePrisma>;
  let service: PipelineStagesService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new PipelineStagesService(prisma as unknown as PrismaService);
  });

  it('creates pipeline stages with normalized active duplicate protection', async () => {
    prisma.marketingPipelineStage.findFirst.mockResolvedValue(null);
    prisma.marketingPipelineStage.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'stage-1', ...data }),
    );

    const result = await service.create(user, {
      name: '  Qualified   Lead ',
      probability: 40,
      description: 'Sales qualified',
      displayOrder: 2,
    });

    expect(prisma.marketingPipelineStage.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        normalizedName: 'qualified lead',
        archivedAt: null,
      },
      select: { id: true },
    });
    expect(prisma.marketingPipelineStage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        name: 'Qualified Lead',
        normalizedName: 'qualified lead',
        probability: 40,
        description: 'Sales qualified',
        displayOrder: 2,
        isActive: true,
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
      }),
    });
    expect(result.name).toBe('Qualified Lead');
  });

  it('lists tenant-scoped non-archived stages with deterministic ordering and active filtering', async () => {
    prisma.marketingPipelineStage.findMany.mockResolvedValue([]);

    await service.list('tenant-1', { isActive: false });

    expect(prisma.marketingPipelineStage.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        archivedAt: null,
        isActive: false,
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('reads details by tenant without leaking cross-tenant records', async () => {
    prisma.marketingPipelineStage.findFirst.mockResolvedValue({
      id: 'stage-1',
    });

    await expect(service.findOne('tenant-1', 'stage-1')).resolves.toEqual({
      id: 'stage-1',
    });

    expect(prisma.marketingPipelineStage.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'stage-1',
        tenantId: 'tenant-1',
        archivedAt: null,
      },
    });
  });

  it('returns not found for missing, archived or cross-tenant stages', async () => {
    prisma.marketingPipelineStage.findFirst.mockResolvedValue(null);

    await expect(service.findOne('tenant-1', 'stage-2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates stages only after a scoped lookup succeeds', async () => {
    prisma.marketingPipelineStage.findFirst
      .mockResolvedValueOnce({
        id: 'stage-1',
        tenantId: 'tenant-1',
        name: 'Lead',
        normalizedName: 'lead',
      })
      .mockResolvedValueOnce(null);
    prisma.marketingPipelineStage.update.mockResolvedValue({
      id: 'stage-1',
      name: 'Negotiation',
    });

    await service.update(user, 'stage-1', {
      name: ' Negotiation ',
      probability: 75,
      displayOrder: 3,
      isActive: false,
    });

    expect(prisma.marketingPipelineStage.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'stage-1',
        tenantId: 'tenant-1',
        archivedAt: null,
      },
    });
    expect(prisma.marketingPipelineStage.update).toHaveBeenCalledWith({
      where: { id: 'stage-1' },
      data: expect.objectContaining({
        name: 'Negotiation',
        normalizedName: 'negotiation',
        probability: 75,
        displayOrder: 3,
        isActive: false,
        updatedByUserId: 'user-1',
      }),
    });
  });

  it('updates display order safely through the normal scoped update path', async () => {
    prisma.marketingPipelineStage.findFirst.mockResolvedValue({
      id: 'stage-1',
      tenantId: 'tenant-1',
      name: 'Lead',
      normalizedName: 'lead',
    });
    prisma.marketingPipelineStage.update.mockResolvedValue({
      id: 'stage-1',
      displayOrder: 10,
    });

    await service.update(user, 'stage-1', { displayOrder: 10 });

    expect(prisma.marketingPipelineStage.update).toHaveBeenCalledWith({
      where: { id: 'stage-1' },
      data: {
        displayOrder: 10,
        updatedByUserId: 'user-1',
      },
    });
  });

  it('rejects empty updates as invalid requests', async () => {
    await expect(service.update(user, 'stage-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('does not update cross-tenant stages', async () => {
    prisma.marketingPipelineStage.findFirst.mockResolvedValue(null);

    await expect(
      service.update(user, 'cross-tenant-stage', { name: 'Won' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.marketingPipelineStage.update).not.toHaveBeenCalled();
  });

  it('archives stages instead of deleting them', async () => {
    prisma.marketingPipelineStage.findFirst.mockResolvedValue({
      id: 'stage-1',
    });
    prisma.marketingPipelineStage.update.mockResolvedValue({
      id: 'stage-1',
      archivedAt: new Date('2026-09-25T00:00:00.000Z'),
    });

    await service.archive(user, 'stage-1');

    expect(prisma.marketingPipelineStage.update).toHaveBeenCalledWith({
      where: { id: 'stage-1' },
      data: {
        archivedAt: expect.any(Date),
        isActive: false,
        updatedByUserId: 'user-1',
      },
    });
  });

  it('allows name reuse when only archived matching stages exist', async () => {
    prisma.marketingPipelineStage.findFirst.mockResolvedValue(null);
    prisma.marketingPipelineStage.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'stage-2', ...data }),
    );

    await service.create(user, { name: 'Qualified', probability: 50 });

    expect(prisma.marketingPipelineStage.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        normalizedName: 'qualified',
        archivedAt: null,
      },
      select: { id: true },
    });
  });

  it('rejects duplicate active stage names before create', async () => {
    prisma.marketingPipelineStage.findFirst.mockResolvedValue({
      id: 'existing',
    });

    await expect(
      service.create(user, { name: ' qualified ', probability: 50 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.marketingPipelineStage.create).not.toHaveBeenCalled();
  });

  it('maps concurrent unique constraint failures to conflict responses', async () => {
    prisma.marketingPipelineStage.findFirst.mockResolvedValue(null);
    prisma.marketingPipelineStage.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create(user, { name: 'Qualified', probability: 50 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('permits the same normalized stage name in another tenant', async () => {
    prisma.marketingPipelineStage.findFirst.mockResolvedValue(null);
    prisma.marketingPipelineStage.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'stage-1', ...data }),
    );

    await service.create(
      { ...user, tenantId: 'tenant-1' },
      { name: 'Qualified', probability: 50 },
    );
    await service.create(
      { ...user, tenantId: 'tenant-2' },
      { name: 'Qualified', probability: 50 },
    );

    expect(prisma.marketingPipelineStage.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        tenantId: 'tenant-2',
        normalizedName: 'qualified',
        archivedAt: null,
      },
      select: { id: true },
    });
  });

  it('validates invalid request payloads through DTO rules', async () => {
    const dto = plainToInstance(CreatePipelineStageDto, {
      name: 'x'.repeat(121),
      probability: 101,
      displayOrder: -1,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['name', 'probability', 'displayOrder']),
    );
  });
});
