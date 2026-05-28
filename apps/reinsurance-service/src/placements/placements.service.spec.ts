import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyType,
  PlacementParticipantRole,
  PlacementStatus,
  PlacementType,
} from '../../prisma/generated/client';
import { PlacementEventPublisher } from '../messaging/placement-event.publisher';
import { PrismaService } from '../prisma/prisma.service';
import { PlacementsService } from './placements.service';

describe('PlacementsService', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  const user: RequestUser = {
    id: 'user-1',
    email: 'broker@example.com',
    role: 'EMPLOYEE',
    tenantId: 'tenant-1',
    tenantSlug: 'broker',
    tenantName: 'Broker',
    firstName: 'Ama',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: [],
  };
  const placement = {
    id: 'placement-1',
    tenantId: 'tenant-1',
    reference: 'FAC-2026-0001',
    normalizedReference: 'fac-2026-0001',
    title: 'Acme Energy Placement',
    placementType: PlacementType.FACULTATIVE,
    status: PlacementStatus.DRAFT,
    cedantId: 'cedant-1',
    classOfBusiness: null,
    description: null,
    inceptionDate: null,
    expiryDate: null,
    currency: null,
    sumInsured: null,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    archivedByUserId: null,
    archivedAt: null,
    createdAt: new Date('2026-05-28T10:00:00.000Z'),
    updatedAt: new Date('2026-05-28T10:00:00.000Z'),
    cedant: {
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
      name: 'Acme Cedant',
      registrationNumber: null,
    },
    participants: [],
    statusHistory: [],
  };

  let prisma: {
    counterparty: {
      findFirst: PrismaMethod;
      findMany: PrismaMethod;
    };
    placement: {
      findMany: PrismaMethod;
      count: PrismaMethod;
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    placementStatusHistory: {
      create: PrismaMethod;
    };
    $transaction: jest.Mock;
  };
  let publisher: {
    created: jest.Mock;
    updated: jest.Mock;
    deleted: jest.Mock;
    statusChanged: jest.Mock;
  };
  let service: PlacementsService;

  beforeEach(() => {
    prisma = {
      counterparty: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placement: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementStatusHistory: {
        create: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    publisher = {
      created: jest.fn().mockResolvedValue(undefined),
      updated: jest.fn().mockResolvedValue(undefined),
      deleted: jest.fn().mockResolvedValue(undefined),
      statusChanged: jest.fn().mockResolvedValue(undefined),
    };
    service = new PlacementsService(
      prisma as unknown as PrismaService,
      publisher as unknown as PlacementEventPublisher,
    );
  });

  it('lists only active records in the current tenant with filters and paging', async () => {
    prisma.placement.findMany.mockResolvedValue([placement]);
    prisma.placement.count.mockResolvedValue(1);

    const result = await service.findAll('tenant-1', {
      search: 'FAC-2026',
      status: PlacementStatus.DRAFT,
      placementType: PlacementType.FACULTATIVE,
      cedantId: 'cedant-1',
      page: 2,
      limit: 10,
    });

    expect(prisma.placement.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        tenantId: 'tenant-1',
        archivedAt: null,
        status: PlacementStatus.DRAFT,
        placementType: PlacementType.FACULTATIVE,
        cedantId: 'cedant-1',
      },
      skip: 10,
      take: 10,
    });
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('does not expose another tenant record by id', async () => {
    prisma.placement.findFirst.mockResolvedValue(null);

    await expect(service.findOne('tenant-1', 'placement-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.placement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'placement-1',
          tenantId: 'tenant-1',
          archivedAt: null,
        },
      }),
    );
  });

  it('creates a draft placement with tenant-owned cedant and participant data', async () => {
    prisma.counterparty.findFirst.mockResolvedValue({ id: 'cedant-1' });
    prisma.counterparty.findMany.mockResolvedValue([
      {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Ghana Re',
      },
    ]);
    prisma.placement.create.mockResolvedValue({
      ...placement,
      participants: [{ id: 'participant-1' }],
    });

    await service.create(user, {
      reference: ' FAC-2026-0001 ',
      title: ' Acme Energy Placement ',
      cedantId: 'cedant-1',
      participants: [
        {
          counterpartyId: 'reinsurer-1',
          role: PlacementParticipantRole.LEAD_REINSURER,
          sharePercent: 45,
        },
      ],
    });

    expect(prisma.counterparty.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'cedant-1',
          tenantId: 'tenant-1',
          type: CounterpartyType.CEDANT,
          archivedAt: null,
        },
      }),
    );
    expect(prisma.placement.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        tenantId: 'tenant-1',
        reference: 'FAC-2026-0001',
        normalizedReference: 'fac-2026-0001',
        status: PlacementStatus.DRAFT,
        participants: {
          create: [
            {
              counterpartyId: 'reinsurer-1',
              role: PlacementParticipantRole.LEAD_REINSURER,
            },
          ],
        },
      },
    });
    expect(publisher.created).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        actorUserId: 'user-1',
      }),
    );
  });

  it('rejects participant roles that do not match counterparty type', async () => {
    prisma.counterparty.findFirst.mockResolvedValue({ id: 'cedant-1' });
    prisma.counterparty.findMany.mockResolvedValue([
      {
        id: 'broker-1',
        type: CounterpartyType.BROKER,
        name: 'Broker Ltd',
      },
    ]);

    await expect(
      service.create(user, {
        reference: 'FAC-2026-0002',
        title: 'Invalid Participant',
        cedantId: 'cedant-1',
        participants: [
          {
            counterpartyId: 'broker-1',
            role: PlacementParticipantRole.LEAD_REINSURER,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placement.create).not.toHaveBeenCalled();
  });

  it('rejects signed lines above offered shares or total capacity', async () => {
    prisma.counterparty.findFirst.mockResolvedValue({ id: 'cedant-1' });

    await expect(
      service.create(user, {
        reference: 'FAC-2026-0004',
        title: 'Invalid Capacity',
        cedantId: 'cedant-1',
        participants: [
          {
            counterpartyId: 'reinsurer-1',
            role: PlacementParticipantRole.REINSURER,
            sharePercent: 20,
            signedLinePercent: 30,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.create(user, {
        reference: 'FAC-2026-0005',
        title: 'Too Much Capacity',
        cedantId: 'cedant-1',
        participants: [
          {
            counterpartyId: 'reinsurer-1',
            role: PlacementParticipantRole.REINSURER,
            signedLinePercent: 60,
          },
          {
            counterpartyId: 'reinsurer-2',
            role: PlacementParticipantRole.CO_REINSURER,
            signedLinePercent: 50,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placement.create).not.toHaveBeenCalled();
  });

  it('updates only an active record using the tenant-qualified compound key', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placement.update.mockResolvedValue({
      ...placement,
      title: 'Updated Placement',
    });

    await service.update(user, 'placement-1', { title: 'Updated Placement' });

    expect(prisma.placement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id_tenantId: { id: 'placement-1', tenantId: 'tenant-1' },
          archivedAt: null,
        },
      }),
    );
    expect(publisher.updated).toHaveBeenCalled();
  });

  it('does not silently mutate a bound placement', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      status: PlacementStatus.BOUND,
    });

    await expect(
      service.update(user, 'placement-1', { title: 'Unsafe Update' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placement.update).not.toHaveBeenCalled();
  });

  it('records status changes in the same transaction as placement update', async () => {
    const marketingPlacement = {
      ...placement,
      status: PlacementStatus.MARKETING,
    };
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placement.update.mockResolvedValue(marketingPlacement);
    prisma.placementStatusHistory.create.mockResolvedValue({
      id: 'status-history-1',
    });

    await service.changeStatus(user, 'placement-1', {
      status: PlacementStatus.MARKETING,
      note: 'Ready for market',
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    const historyArgs = prisma.placementStatusHistory.create.mock
      .calls[0]?.[0] as {
      data: {
        tenantId: string;
        placementId: string;
        fromStatus: PlacementStatus;
        toStatus: PlacementStatus;
      };
    };
    expect(historyArgs.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      fromStatus: PlacementStatus.DRAFT,
      toStatus: PlacementStatus.MARKETING,
    });
    expect(publisher.statusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStatus: PlacementStatus.DRAFT,
        nextStatus: PlacementStatus.MARKETING,
      }),
    );
  });

  it('archives only an active record in the current tenant', async () => {
    const archived = {
      ...placement,
      archivedAt: new Date('2026-05-28T11:00:00.000Z'),
    };
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placement.update.mockResolvedValue(archived);

    await service.archive(user, 'placement-1');

    expect(prisma.placement.update.mock.calls[0]?.[0]).toMatchObject({
      where: {
        id_tenantId: { id: 'placement-1', tenantId: 'tenant-1' },
        archivedAt: null,
      },
      data: {
        archivedByUserId: 'user-1',
      },
    });
    expect(publisher.deleted).toHaveBeenCalled();
  });

  it('does not fail a completed write when audit event delivery fails', async () => {
    const loggerWarn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    prisma.counterparty.findFirst.mockResolvedValue({ id: 'cedant-1' });
    prisma.counterparty.findMany.mockResolvedValue([]);
    prisma.placement.create.mockResolvedValue(placement);
    publisher.created.mockRejectedValueOnce(new Error('broker offline'));

    await expect(
      service.create(user, {
        reference: 'FAC-2026-0003',
        title: 'Fail Open Audit',
        cedantId: 'cedant-1',
      }),
    ).resolves.toEqual(placement);
    await Promise.resolve();

    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('audit event failed'),
    );
    loggerWarn.mockRestore();
  });
});
