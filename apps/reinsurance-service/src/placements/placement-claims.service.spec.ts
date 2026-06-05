import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PlacementClaimStatus,
  PlacementClosingStatus,
  PlacementPaymentType,
  PlacementStatus,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlacementClaimsService } from './placement-claims.service';
import { PlacementFinancialActivityReader } from './placement-financial-activity.reader';
import { PlacementFinancialLockPolicy } from './placement-financial-lock.policy';

describe('PlacementClaimsService', () => {
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
    currency: 'GHS',
  };

  const claim = {
    id: 'claim-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    claimNumber: 'CLM-001',
    status: PlacementClaimStatus.DRAFT,
    occurrenceDate: new Date('2026-06-03T00:00:00.000Z'),
    reportedDate: new Date('2026-06-05T10:00:00.000Z'),
    claimCause: 'Warehouse fire',
    occurrenceDetails: null,
    currency: 'GHS',
    estimatedLossAmount: new Prisma.Decimal('40000.00'),
    finalLossAmount: null,
    finalizedAt: null,
    finalizedByUserId: null,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    closedAt: null,
    voidedAt: null,
    createdAt: new Date('2026-06-05T10:00:00.000Z'),
    updatedAt: new Date('2026-06-05T10:00:00.000Z'),
  };

  let prisma: {
    placement: { findFirst: PrismaMethod };
    placementClaim: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      count: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    placementClaimAllocation: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      createMany: PrismaMethod;
    };
    placementClosing: { findMany: PrismaMethod };
    placementEndorsementClosing: { findMany: PrismaMethod };
    placementPayment: { findFirst: PrismaMethod };
    placementNote: { update: PrismaMethod };
    $transaction: jest.Mock;
  };
  let service: PlacementClaimsService;
  let lockPolicy: PlacementFinancialLockPolicy;

  beforeEach(() => {
    prisma = {
      placement: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClaim: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimAllocation: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        createMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClosing: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsementClosing: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementPayment: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementNote: {
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    service = new PlacementClaimsService(prisma as unknown as PrismaService);
    lockPolicy = new PlacementFinancialLockPolicy(
      new PlacementFinancialActivityReader(prisma as unknown as PrismaService),
    );
  });

  it('creates a claim loss event with placement-scoped CLM numbering', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.count.mockResolvedValue(0);
    prisma.placementClaim.create.mockResolvedValue(claim);

    await service.create(user, 'placement-1', {
      occurrenceDate: '2026-06-03T00:00:00.000Z',
      reportedDate: '2026-06-05T10:00:00.000Z',
      claimCause: ' Warehouse fire ',
      occurrenceDetails: ' Section B ',
      currency: 'ghs',
      estimatedLossAmount: 40000,
    });

    const createArgs = firstCallArg<Prisma.PlacementClaimCreateArgs>(
      prisma.placementClaim.create,
    );
    expect(createArgs.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimNumber: 'CLM-001',
      status: PlacementClaimStatus.DRAFT,
      claimCause: 'Warehouse fire',
      occurrenceDetails: 'Section B',
      currency: 'GHS',
      estimatedLossAmount: 40000,
      finalLossAmount: null,
      createdByUserId: 'user-1',
      updatedByUserId: 'user-1',
    });
  });

  it('rejects wrong-tenant or archived placement when creating claim', async () => {
    prisma.placement.findFirst.mockResolvedValue(null);

    await expect(
      service.create(user, 'placement-1', {
        occurrenceDate: '2026-06-03T00:00:00.000Z',
        reportedDate: '2026-06-05T10:00:00.000Z',
        claimCause: 'Warehouse fire',
        currency: 'GHS',
        estimatedLossAmount: 40000,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('sets finalLossAmount and finalized metadata on editable claim update', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaim.update.mockResolvedValue({
      ...claim,
      finalLossAmount: new Prisma.Decimal('37500.00'),
      finalizedByUserId: 'user-1',
    });

    await service.update(user, 'placement-1', 'claim-1', {
      finalLossAmount: 37500,
    });

    const updateArgs = firstCallArg<Prisma.PlacementClaimUpdateArgs>(
      prisma.placementClaim.update,
    );
    expect(updateArgs.data).toMatchObject({
      finalLossAmount: 37500,
      finalizedByUserId: 'user-1',
      updatedByUserId: 'user-1',
    });
    expect(updateArgs.data).toHaveProperty('finalizedAt');
  });

  it('rejects editing CLOSED or VOID claims', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      status: PlacementClaimStatus.CLOSED,
    });

    await expect(
      service.update(user, 'placement-1', 'claim-1', {
        claimCause: 'Updated cause',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('enforces claim lifecycle transitions and terminal states', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaim.update.mockResolvedValue({
      ...claim,
      status: PlacementClaimStatus.NOTIFIED,
    });

    await service.changeStatus(user, 'placement-1', 'claim-1', {
      status: PlacementClaimStatus.NOTIFIED,
    });

    const statusUpdateArgs = firstCallArg<Prisma.PlacementClaimUpdateArgs>(
      prisma.placementClaim.update,
    );
    expect(statusUpdateArgs.data).toMatchObject({
      status: PlacementClaimStatus.NOTIFIED,
      updatedByUserId: 'user-1',
    });

    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      status: PlacementClaimStatus.CLOSED,
    });
    await expect(
      service.changeStatus(user, 'placement-1', 'claim-1', {
        status: PlacementClaimStatus.NOTIFIED,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('generates allocations from confirmed placement and endorsement closing snapshots', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      finalLossAmount: new Prisma.Decimal('37500.00'),
    });
    prisma.placementClaimAllocation.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findMany.mockResolvedValue([
      {
        id: 'closing-1',
        participantId: 'participant-1',
        signedLinePercent: new Prisma.Decimal('40.0000'),
        participant: { counterpartyId: 'reinsurer-1' },
      },
    ]);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        id: 'endorsement-closing-1',
        endorsementParticipantId: 'endorsement-participant-1',
        signedLinePercent: new Prisma.Decimal('10.0000'),
        endorsementParticipant: { counterpartyId: 'reinsurer-2' },
      },
    ]);
    prisma.placementClaimAllocation.createMany.mockResolvedValue({ count: 2 });
    prisma.placementClaimAllocation.findMany.mockResolvedValue([]);

    await service.generateAllocations(user, 'placement-1', 'claim-1');

    const placementClosingFindArgs =
      firstCallArg<Prisma.PlacementClosingFindManyArgs>(
        prisma.placementClosing.findMany,
      );
    expect(placementClosingFindArgs.where).toMatchObject({
      status: PlacementClosingStatus.CONFIRMED,
    });
    const endorsementClosingFindArgs =
      firstCallArg<Prisma.PlacementEndorsementClosingFindManyArgs>(
        prisma.placementEndorsementClosing.findMany,
      );
    expect(endorsementClosingFindArgs.where).toMatchObject({
      status: PlacementClosingStatus.CONFIRMED,
    });
    const createManyArgs =
      firstCallArg<Prisma.PlacementClaimAllocationCreateManyArgs>(
        prisma.placementClaimAllocation.createMany,
      );
    expect(createManyArgs.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          placementClosingId: 'closing-1',
          participantId: 'participant-1',
          counterpartyId: 'reinsurer-1',
          signedLinePercent: 40,
          basisAmount: 37500,
          allocatedEstimatedLossAmount: 16000,
          allocatedFinalLossAmount: 15000,
          cashCallAmount: null,
          paidAmount: null,
        }),
        expect.objectContaining({
          endorsementClosingId: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          counterpartyId: 'reinsurer-2',
          signedLinePercent: 10,
          basisAmount: 37500,
          allocatedEstimatedLossAmount: 4000,
          allocatedFinalLossAmount: 3750,
          cashCallAmount: null,
          paidAmount: null,
        }),
      ]),
    );
  });

  it('rejects allocation generation when no confirmed closings exist', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaimAllocation.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findMany.mockResolvedValue([]);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([]);

    await expect(
      service.generateAllocations(user, 'placement-1', 'claim-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate allocation generation', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaimAllocation.findFirst.mockResolvedValue({
      id: 'allocation-1',
    });

    await expect(
      service.generateAllocations(user, 'placement-1', 'claim-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('does not lock placement or mutate financial records when creating a claim', async () => {
    const unlockedPlacement = {
      id: 'placement-1',
      tenantId: 'tenant-1',
      status: PlacementStatus.CLOSED,
    };
    prisma.placementPayment.findFirst.mockResolvedValue(null);
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementClaim.count.mockResolvedValue(0);
    prisma.placementClaim.create.mockResolvedValue(claim);

    await expect(lockPolicy.evaluate(unlockedPlacement)).resolves.toMatchObject(
      {
        locked: false,
        endorsementRequired: false,
      },
    );

    await service.create(user, 'placement-1', {
      occurrenceDate: '2026-06-03T00:00:00.000Z',
      reportedDate: '2026-06-05T10:00:00.000Z',
      claimCause: 'Warehouse fire',
      currency: 'GHS',
      estimatedLossAmount: 40000,
    });

    expect(prisma.placementNote.update).not.toHaveBeenCalled();
    await expect(lockPolicy.evaluate(unlockedPlacement)).resolves.toMatchObject(
      {
        locked: false,
        endorsementRequired: false,
      },
    );
  });

  it('keeps payment as the only hard lock source for future claim settlements', async () => {
    const lockedPlacement = {
      id: 'placement-1',
      tenantId: 'tenant-1',
      status: PlacementStatus.CLOSED,
    };
    const paymentDate = new Date('2026-06-05T13:00:00.000Z');
    prisma.placementPayment.findFirst.mockResolvedValue({
      type: PlacementPaymentType.CLAIM_SETTLEMENT,
      paymentDate,
      createdAt: paymentDate,
    });

    await expect(lockPolicy.evaluate(lockedPlacement)).resolves.toMatchObject({
      locked: true,
      endorsementRequired: true,
      lockSource: 'CLAIM_SETTLEMENT',
    });
  });
});
