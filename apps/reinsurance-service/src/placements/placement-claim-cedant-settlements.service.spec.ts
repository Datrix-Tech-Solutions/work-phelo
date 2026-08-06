import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  ReinsuranceAccountingOutboxStatus,
  PlacementClaimCedantSettlementStatus,
  PlacementClaimStatus,
  Prisma,
} from '../../prisma/generated/client';
import { ReinsuranceFinancialEventPublisher } from '../accounting-integration/reinsurance-financial-event-publisher.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlacementClaimCedantSettlementsService } from './placement-claim-cedant-settlements.service';
import { ReinsuranceMoneyHelper } from './reinsurance-money.helper';

describe('PlacementClaimCedantSettlementsService', () => {
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
    moduleConfig: { operations: true, accounting: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: [],
  };

  const claim = {
    id: 'claim-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    claimNumber: 'CLM-001',
    status: PlacementClaimStatus.RESERVED,
    occurrenceDate: new Date('2026-07-01T00:00:00.000Z'),
    reportedDate: new Date('2026-07-02T00:00:00.000Z'),
    claimCause: 'Fire',
    occurrenceDetails: null,
    currency: 'GHS',
    estimatedLossAmount: new Prisma.Decimal('120000.00'),
    finalLossAmount: new Prisma.Decimal('100000.00'),
    finalizedAt: new Date('2026-07-10T00:00:00.000Z'),
    finalizedByUserId: 'adjuster-1',
    approvedPayableAmount: null,
    approvedAt: null,
    approvedByUserId: null,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    closedAt: null,
    voidedAt: null,
    createdAt: new Date('2026-07-02T00:00:00.000Z'),
    updatedAt: new Date('2026-07-10T00:00:00.000Z'),
  };

  const settlement = {
    id: 'settlement-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    claimId: 'claim-1',
    currency: 'GHS',
    amount: new Prisma.Decimal('40000.00'),
    settlementDate: new Date('2026-07-29T12:00:00.000Z'),
    reference: 'PAY-001',
    notes: null,
    status: PlacementClaimCedantSettlementStatus.RECORDED,
    reversalOfSettlementId: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-07-29T12:00:00.000Z'),
    updatedAt: new Date('2026-07-29T12:00:00.000Z'),
    reversalSettlements: [],
  };

  let prisma: {
    placement: { findFirst: PrismaMethod };
    placementClaim: {
      findFirst: PrismaMethod;
      update: PrismaMethod;
    };
    placementClaimAllocation: {
      count: PrismaMethod;
    };
    placementClaimPayableApproval: {
      findFirst: PrismaMethod;
      create: PrismaMethod;
    };
    placementClaimCedantSettlement: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    $transaction: jest.Mock;
  };
  let financialEvents: {
    prepareClaimPayableApproved: jest.Mock;
    enqueuePreparedEvent: jest.Mock;
  };
  let service: PlacementClaimCedantSettlementsService;

  beforeEach(() => {
    prisma = {
      placement: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClaim: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimAllocation: {
        count: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimPayableApproval: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimCedantSettlement: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaimAllocation.count.mockResolvedValue(1);
    prisma.placementClaimPayableApproval.findFirst.mockResolvedValue(null);
    prisma.placementClaimPayableApproval.create.mockResolvedValue({
      id: 'approval-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      approvalVersion: 1,
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
      finalLossAmount: new Prisma.Decimal('100000.00'),
      currency: 'GHS',
      approvedAt: new Date('2026-07-30T10:00:00.000Z'),
      approvedByUserId: 'user-1',
      notes: null,
      createdAt: new Date('2026-07-30T10:00:00.000Z'),
    });
    prisma.placementClaimCedantSettlement.findMany.mockResolvedValue([]);
    financialEvents = {
      prepareClaimPayableApproved: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        sourceEventType: 'CLAIM_PAYABLE_APPROVED',
        sourceRecordType: 'PlacementClaimPayableApproval',
        sourceRecordId: 'approval-1',
        sourceDocumentId: 'claim-1',
        idempotencyKey: 'reinsurance:claim:claim-1:payable-approved:1:v1',
        occurredAt: '2026-07-30T10:00:00.000Z',
        currency: 'GHS',
        payload: { amounts: { approvedPayableAmount: 90000 } },
      }),
      enqueuePreparedEvent: jest.fn().mockResolvedValue({
        id: 'outbox-1',
        status: ReinsuranceAccountingOutboxStatus.PENDING,
        accountingSourceEventId: null,
      }),
    };
    service = new PlacementClaimCedantSettlementsService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
      financialEvents as unknown as ReinsuranceFinancialEventPublisher,
    );
  });

  it('records claim-level payable approval and captures accounting event once', async () => {
    prisma.placementClaim.update.mockResolvedValue({
      ...claim,
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
    });

    await service.approvePayable(user, 'placement-1', 'claim-1', {
      approvedPayableAmount: 90000,
      currency: 'GHS',
      notes: ' Reinsurer approval confirmed ',
    });

    const approvalCreateArgs =
      firstCallArg<Prisma.PlacementClaimPayableApprovalCreateArgs>(
        prisma.placementClaimPayableApproval.create,
      );
    expect(approvalCreateArgs.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      approvalVersion: 1,
      approvedPayableAmount: 90000,
      finalLossAmount: 100000,
      currency: 'GHS',
      approvedByUserId: 'user-1',
      notes: 'Reinsurer approval confirmed',
    });
    const args = firstCallArg<Prisma.PlacementClaimUpdateArgs>(
      prisma.placementClaim.update,
    );
    expect(args.data).toMatchObject({
      approvedPayableAmount: 90000,
      approvedByUserId: 'user-1',
      updatedByUserId: 'user-1',
    });
    expect(financialEvents.prepareClaimPayableApproved).toHaveBeenCalledTimes(
      1,
    );
    expect(financialEvents.enqueuePreparedEvent).toHaveBeenCalledTimes(1);
  });

  it('requires final loss, active allocation, amount within final loss and matching currency', async () => {
    await expect(
      service.approvePayable(user, 'placement-1', 'claim-1', {
        approvedPayableAmount: 100000.01,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.approvePayable(user, 'placement-1', 'claim-1', {
        approvedPayableAmount: 90000,
        currency: 'USD',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      finalLossAmount: null,
    });
    await expect(
      service.approvePayable(user, 'placement-1', 'claim-1', {
        approvedPayableAmount: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.placementClaim.findFirst.mockResolvedValue(claim);
    prisma.placementClaimAllocation.count.mockResolvedValue(0);
    await expect(
      service.approvePayable(user, 'placement-1', 'claim-1', {
        approvedPayableAmount: 90000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('treats duplicate same-version approval as idempotent and blocks mutation', async () => {
    prisma.placementClaimPayableApproval.findFirst.mockResolvedValue({
      id: 'approval-1',
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      approvalVersion: 1,
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
      finalLossAmount: new Prisma.Decimal('100000.00'),
      currency: 'GHS',
      approvedAt: new Date('2026-07-30T10:00:00.000Z'),
      approvedByUserId: 'user-1',
      notes: null,
      createdAt: new Date('2026-07-30T10:00:00.000Z'),
    });

    const result = await service.approvePayable(
      user,
      'placement-1',
      'claim-1',
      {
        approvedPayableAmount: 90000,
      },
    );

    expect(result).toBe(claim);
    expect(prisma.placementClaimPayableApproval.create).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();

    await expect(
      service.approvePayable(user, 'placement-1', 'claim-1', {
        approvedPayableAmount: 85000,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('still approves operationally when Accounting is disabled', async () => {
    financialEvents.prepareClaimPayableApproved.mockResolvedValue(null);
    prisma.placementClaim.update.mockResolvedValue({
      ...claim,
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
    });

    await service.approvePayable(
      { ...user, moduleConfig: { operations: true, accounting: false } },
      'placement-1',
      'claim-1',
      { approvedPayableAmount: 90000 },
    );

    expect(prisma.placementClaimPayableApproval.create).toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('rejects lowering approved payable below effective cedant settlements', async () => {
    prisma.placementClaimCedantSettlement.findMany.mockResolvedValue([
      {
        amount: new Prisma.Decimal('60000.00'),
        status: PlacementClaimCedantSettlementStatus.RECORDED,
        reversalOfSettlementId: null,
      },
    ]);

    await expect(
      service.approvePayable(user, 'placement-1', 'claim-1', {
        approvedPayableAmount: 50000,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('records partial settlement against approved payable and rejects over-settlement', async () => {
    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
    });
    prisma.placementClaimCedantSettlement.findMany.mockResolvedValue([
      {
        amount: new Prisma.Decimal('40000.00'),
        status: PlacementClaimCedantSettlementStatus.RECORDED,
        reversalOfSettlementId: null,
      },
    ]);
    prisma.placementClaimCedantSettlement.create.mockResolvedValue({
      ...settlement,
      amount: new Prisma.Decimal('50000.00'),
    });

    await service.create(user, 'placement-1', 'claim-1', {
      currency: 'GHS',
      amount: 50000,
      settlementDate: '2026-07-29T12:00:00.000Z',
      reference: ' PAY-002 ',
    });

    const args = firstCallArg<Prisma.PlacementClaimCedantSettlementCreateArgs>(
      prisma.placementClaimCedantSettlement.create,
    );
    expect(args.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      currency: 'GHS',
      amount: 50000,
      reference: 'PAY-002',
      status: PlacementClaimCedantSettlementStatus.RECORDED,
    });

    await expect(
      service.create(user, 'placement-1', 'claim-1', {
        currency: 'GHS',
        amount: 50000.01,
        settlementDate: '2026-07-29T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects settlement without approval and wrong currency', async () => {
    await expect(
      service.create(user, 'placement-1', 'claim-1', {
        currency: 'GHS',
        amount: 1000,
        settlementDate: '2026-07-29T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.placementClaim.findFirst.mockResolvedValue({
      ...claim,
      approvedPayableAmount: new Prisma.Decimal('90000.00'),
    });

    await expect(
      service.create(user, 'placement-1', 'claim-1', {
        currency: 'USD',
        amount: 1000,
        settlementDate: '2026-07-29T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reverses settlement immutably and rejects duplicate reversal', async () => {
    prisma.placementClaimCedantSettlement.findFirst.mockResolvedValue(
      settlement,
    );
    prisma.placementClaimCedantSettlement.update.mockResolvedValue({
      ...settlement,
      status: PlacementClaimCedantSettlementStatus.REVERSED,
    });
    prisma.placementClaimCedantSettlement.create.mockResolvedValue({
      ...settlement,
      id: 'settlement-reversal-1',
      reversalOfSettlementId: 'settlement-1',
    });

    await service.reverse(user, 'placement-1', 'claim-1', 'settlement-1', {
      notes: 'Correction',
    });

    expect(prisma.placementClaimCedantSettlement.update).toHaveBeenCalledWith({
      where: { id: 'settlement-1' },
      data: { status: PlacementClaimCedantSettlementStatus.REVERSED },
    });

    prisma.placementClaimCedantSettlement.findFirst.mockResolvedValue({
      ...settlement,
      status: PlacementClaimCedantSettlementStatus.REVERSED,
    });

    await expect(
      service.reverse(user, 'placement-1', 'claim-1', 'settlement-1', {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
