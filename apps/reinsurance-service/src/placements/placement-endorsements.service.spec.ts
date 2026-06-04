import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PlacementEndorsementStatus,
  PlacementEndorsementType,
  PlacementStatus,
  PlacementType,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlacementEndorsementsService } from './placement-endorsements.service';

describe('PlacementEndorsementsService', () => {
  type PrismaMethod = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  const firstCallArg = <TArgs>(mock: PrismaMethod): TArgs => {
    const call = mock.mock.calls[0];
    if (!call) throw new Error('Expected Prisma mock to be called');
    return call[0] as TArgs;
  };

  const user = {
    id: 'user-1',
    email: 'broker@example.com',
    role: 'EMPLOYEE' as const,
    tenantId: 'tenant-1',
    tenantSlug: 'broker',
    tenantName: 'Broker',
    firstName: 'Ama',
    moduleConfig: { operations: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: [] as string[],
  };

  const placement = {
    id: 'placement-1',
    tenantId: 'tenant-1',
    reference: 'FAC-001',
    normalizedReference: 'fac-001',
    title: 'Energy Risk',
    placementType: PlacementType.FACULTATIVE,
    status: PlacementStatus.CLOSED,
    cedantId: 'cedant-1',
    riskTypeId: 'risk-type-1',
    classOfBusiness: null,
    businessDetails: { location: 'Accra' },
    offerDetails: { notes: 'Original offer' },
    description: 'Original placement',
    inceptionDate: new Date('2026-06-01T00:00:00.000Z'),
    expiryDate: new Date('2027-06-01T00:00:00.000Z'),
    currency: 'USD',
    exchangeRateToBase: new Prisma.Decimal('1.000000'),
    sumInsured: new Prisma.Decimal('100000.00'),
    rate: new Prisma.Decimal('2.5000'),
    premium: new Prisma.Decimal('2500.00'),
    commission: new Prisma.Decimal('10.0000'),
    facultativeOffer: new Prisma.Decimal('70.0000'),
    preliminaryBrokerage: new Prisma.Decimal('7.5000'),
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    archivedByUserId: null,
    archivedAt: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-02T00:00:00.000Z'),
    participants: [
      {
        id: 'participant-1',
        counterpartyId: 'reinsurer-1',
        role: 'REINSURER',
        status: 'ACCEPTED',
        sharePercent: new Prisma.Decimal('40.0000'),
        signedLinePercent: new Prisma.Decimal('30.0000'),
        brokerageFee: new Prisma.Decimal('7.50'),
        notes: null,
      },
    ],
    closings: [
      {
        id: 'closing-1',
        participantId: 'participant-1',
        closingNumber: 'CLO-001',
        status: 'CONFIRMED',
        signedLinePercent: new Prisma.Decimal('30.0000'),
        sharePercent: new Prisma.Decimal('40.0000'),
        grossPremium: new Prisma.Decimal('750.00'),
        commissionPercent: new Prisma.Decimal('10.0000'),
        commissionAmount: new Prisma.Decimal('75.00'),
        brokeragePercent: new Prisma.Decimal('7.50'),
        brokerageAmount: new Prisma.Decimal('56.25'),
        netPremium: new Prisma.Decimal('618.75'),
        currency: 'USD',
        issuedAt: new Date('2026-06-02T10:00:00.000Z'),
        confirmedAt: new Date('2026-06-02T11:00:00.000Z'),
      },
    ],
    payments: [
      {
        id: 'payment-1',
        type: 'PREMIUM_RECEIVED',
        direction: 'INBOUND',
        amount: new Prisma.Decimal('1000.00'),
        currency: 'USD',
        status: 'RECORDED',
        paymentDate: new Date('2026-06-03T00:00:00.000Z'),
        counterpartyId: 'cedant-1',
        closingId: null,
        participantId: null,
      },
    ],
    notes: [
      {
        id: 'note-1',
        type: 'DEBIT_NOTE',
        direction: 'CEDANT_TO_BROKER',
        noteNumber: 'DN-001',
        status: 'ISSUED',
        grossAmount: new Prisma.Decimal('750.00'),
        netAmount: new Prisma.Decimal('675.00'),
        currency: 'USD',
        closingId: null,
        participantId: null,
        counterpartyId: 'cedant-1',
      },
    ],
  };

  const endorsement = {
    id: 'endorsement-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    endorsementNumber: 'END-001',
    type: PlacementEndorsementType.SUM_INSURED_INCREASE,
    status: PlacementEndorsementStatus.DRAFT,
    effectiveDate: new Date('2026-06-04T00:00:00.000Z'),
    reason: 'Increase sum insured',
    description: null,
    changeSummary: null,
    originalSnapshot: { placement: { id: 'placement-1' } },
    proposedSnapshot: { sumInsured: '150000.00' },
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    closedAt: null,
    voidedAt: null,
    createdAt: new Date('2026-06-04T00:00:00.000Z'),
    updatedAt: new Date('2026-06-04T00:00:00.000Z'),
  };

  let prisma: {
    placement: { findFirst: PrismaMethod; update: PrismaMethod };
    placementEndorsement: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      count: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    $transaction: jest.Mock;
  };
  let service: PlacementEndorsementsService;

  beforeEach(() => {
    prisma = {
      placement: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsement: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    service = new PlacementEndorsementsService(
      prisma as unknown as PrismaService,
    );
  });

  it('creates an endorsement without mutating the original placement', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.count.mockResolvedValue(0);
    prisma.placementEndorsement.create.mockResolvedValue(endorsement);

    await service.create(user, 'placement-1', {
      type: PlacementEndorsementType.SUM_INSURED_INCREASE,
      effectiveDate: '2026-06-04T00:00:00.000Z',
      reason: 'Increase sum insured',
      proposedSnapshot: { sumInsured: '150000.00' },
    });

    const createArgs = firstCallArg<Prisma.PlacementEndorsementCreateArgs>(
      prisma.placementEndorsement.create,
    );
    expect(createArgs.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      endorsementNumber: 'END-001',
      status: PlacementEndorsementStatus.DRAFT,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
    });
    expect(createArgs.data.originalSnapshot).toMatchObject({
      placement: {
        id: 'placement-1',
        sumInsured: '100000',
        premium: '2500',
      },
      participants: [expect.objectContaining({ id: 'participant-1' })],
      closings: [expect.objectContaining({ id: 'closing-1' })],
      payments: [expect.objectContaining({ id: 'payment-1' })],
      notes: [expect.objectContaining({ id: 'note-1' })],
    });
    expect(prisma.placement.update).not.toHaveBeenCalled();
  });

  it('increments endorsement numbering per placement', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.count.mockResolvedValue(1);
    prisma.placementEndorsement.create.mockResolvedValue({
      ...endorsement,
      endorsementNumber: 'END-002',
    });

    const result = await service.create(user, 'placement-1', {
      type: PlacementEndorsementType.PREMIUM_ADJUSTMENT,
      effectiveDate: '2026-06-04T00:00:00.000Z',
      reason: 'Adjust premium',
    });

    expect(result.endorsementNumber).toBe('END-002');
  });

  it('rejects endorsement creation before any placement closing exists', async () => {
    prisma.placement.findFirst.mockResolvedValue({
      ...placement,
      closings: [],
    });

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementEndorsementType.PREMIUM_ADJUSTMENT,
        effectiveDate: '2026-06-04T00:00:00.000Z',
        reason: 'Formal premium adjustment',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.placementEndorsement.create).not.toHaveBeenCalled();
  });

  it('does not expose endorsements for another tenant placement', async () => {
    prisma.placement.findFirst.mockResolvedValue(null);

    await expect(service.findAll('tenant-1', 'placement-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updates only draft endorsements', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue(endorsement);
    prisma.placementEndorsement.update.mockResolvedValue({
      ...endorsement,
      reason: 'Updated',
    });

    await service.update(user, 'placement-1', 'endorsement-1', {
      reason: 'Updated',
    });

    const updateArgs = firstCallArg<Prisma.PlacementEndorsementUpdateArgs>(
      prisma.placementEndorsement.update,
    );
    expect(updateArgs.data).toMatchObject({
      reason: 'Updated',
      updatedByUserId: 'user-1',
    });
  });

  it.each([PlacementEndorsementStatus.CLOSED, PlacementEndorsementStatus.VOID])(
    'rejects edits when endorsement status is %s',
    async (status) => {
      prisma.placement.findFirst.mockResolvedValue(placement);
      prisma.placementEndorsement.findFirst.mockResolvedValue({
        ...endorsement,
        status,
      });

      await expect(
        service.update(user, 'placement-1', 'endorsement-1', {
          reason: 'Updated',
        }),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('allows supported lifecycle transitions and stamps closedAt', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.CLOSING,
    });
    prisma.placementEndorsement.update.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.CLOSED,
      closedAt: new Date('2026-06-04T10:00:00.000Z'),
    });

    await service.changeStatus(user, 'placement-1', 'endorsement-1', {
      status: PlacementEndorsementStatus.CLOSED,
    });

    const updateArgs = firstCallArg<Prisma.PlacementEndorsementUpdateArgs>(
      prisma.placementEndorsement.update,
    );
    expect(updateArgs.data).toMatchObject({
      status: PlacementEndorsementStatus.CLOSED,
      updatedByUserId: 'user-1',
    });
    expect(updateArgs.data).toHaveProperty('closedAt');
  });

  it('rejects unsupported status transitions from terminal statuses', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      ...endorsement,
      status: PlacementEndorsementStatus.VOID,
    });

    await expect(
      service.changeStatus(user, 'placement-1', 'endorsement-1', {
        status: PlacementEndorsementStatus.MARKETING,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
