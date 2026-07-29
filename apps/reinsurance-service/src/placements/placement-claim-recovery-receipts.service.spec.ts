import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  CounterpartyType,
  PlacementClaimCashCallStatus,
  PlacementClaimRecoveryReceiptStatus,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlacementClaimRecoveryReceiptsService } from './placement-claim-recovery-receipts.service';
import { ReinsuranceMoneyHelper } from './reinsurance-money.helper';

describe('PlacementClaimRecoveryReceiptsService', () => {
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
    permissions: [],
  };

  const counterparty = {
    id: 'reinsurer-1',
    type: CounterpartyType.REINSURER,
    name: 'Avenue Re',
    registrationNumber: null,
  };

  const receipt = {
    id: 'receipt-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    claimId: 'claim-1',
    allocationId: 'allocation-1',
    cashCallId: 'cash-call-1',
    counterpartyId: 'reinsurer-1',
    currency: 'GHS',
    amount: new Prisma.Decimal('40000.00'),
    paymentDate: new Date('2026-07-29T12:00:00.000Z'),
    reference: 'BANK-001',
    notes: null,
    status: PlacementClaimRecoveryReceiptStatus.RECORDED,
    reversalOfReceiptId: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-07-29T12:00:00.000Z'),
    updatedAt: new Date('2026-07-29T12:00:00.000Z'),
    counterparty,
    reversalReceipts: [],
  };

  const cashCall = {
    id: 'cash-call-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    claimId: 'claim-1',
    allocationId: 'allocation-1',
    counterpartyId: 'reinsurer-1',
    cashCallNumber: 'CCL-001',
    status: PlacementClaimCashCallStatus.ISSUED,
    currency: 'GHS',
    amount: new Prisma.Decimal('100000.00'),
    basisAmount: new Prisma.Decimal('250000.00'),
    signedLinePercent: new Prisma.Decimal('40.0000'),
    issuedAt: new Date('2026-07-29T10:00:00.000Z'),
    paidAt: null,
    voidedAt: null,
    voidReason: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-07-29T10:00:00.000Z'),
    updatedAt: new Date('2026-07-29T10:00:00.000Z'),
    counterparty,
    allocation: {
      id: 'allocation-1',
      allocatedEstimatedLossAmount: new Prisma.Decimal('100000.00'),
      allocatedFinalLossAmount: null,
    },
    recoveryReceipts: [],
  };

  let prisma: {
    placement: { findFirst: PrismaMethod };
    placementClaim: { findFirst: PrismaMethod };
    placementClaimCashCall: { findFirst: PrismaMethod; findMany: PrismaMethod };
    placementClaimRecoveryReceipt: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    $transaction: jest.Mock;
  };
  let service: PlacementClaimRecoveryReceiptsService;

  beforeEach(() => {
    prisma = {
      placement: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClaim: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClaimCashCall: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementClaimRecoveryReceipt: {
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
    prisma.placementClaim.findFirst.mockResolvedValue({
      id: 'claim-1',
      placementId: 'placement-1',
      currency: 'GHS',
    });
    service = new PlacementClaimRecoveryReceiptsService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
  });

  it('lists receipts with tenant, claim and cash-call scoping', async () => {
    prisma.placementClaimCashCall.findFirst.mockResolvedValue(cashCall);
    prisma.placementClaimRecoveryReceipt.findMany.mockResolvedValue([receipt]);

    await service.findAll('tenant-1', 'placement-1', 'claim-1', 'cash-call-1');

    const args = firstCallArg<Prisma.PlacementClaimRecoveryReceiptFindManyArgs>(
      prisma.placementClaimRecoveryReceipt.findMany,
    );
    expect(args.where).toEqual({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      cashCallId: 'cash-call-1',
    });
  });

  it('rejects DRAFT and VOID cash calls', async () => {
    prisma.placementClaimCashCall.findFirst.mockResolvedValue({
      ...cashCall,
      status: PlacementClaimCashCallStatus.DRAFT,
    });

    await expect(
      service.create(user, 'placement-1', 'claim-1', 'cash-call-1', {
        currency: 'GHS',
        amount: 1000,
        paymentDate: '2026-07-29T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.placementClaimCashCall.findFirst.mockResolvedValue({
      ...cashCall,
      status: PlacementClaimCashCallStatus.VOID,
    });

    await expect(
      service.create(user, 'placement-1', 'claim-1', 'cash-call-1', {
        currency: 'GHS',
        amount: 1000,
        paymentDate: '2026-07-29T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records partial recovery against an ISSUED cash call', async () => {
    prisma.placementClaimCashCall.findFirst.mockResolvedValue(cashCall);
    prisma.placementClaimRecoveryReceipt.create.mockResolvedValue(receipt);

    await service.create(user, 'placement-1', 'claim-1', 'cash-call-1', {
      currency: 'GHS',
      amount: 40000,
      paymentDate: '2026-07-29T12:00:00.000Z',
      reference: ' BANK-001 ',
    });

    const args = firstCallArg<Prisma.PlacementClaimRecoveryReceiptCreateArgs>(
      prisma.placementClaimRecoveryReceipt.create,
    );
    expect(args.data).toMatchObject({
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      claimId: 'claim-1',
      allocationId: 'allocation-1',
      cashCallId: 'cash-call-1',
      counterpartyId: 'reinsurer-1',
      currency: 'GHS',
      amount: 40000,
      reference: 'BANK-001',
      status: PlacementClaimRecoveryReceiptStatus.RECORDED,
    });
  });

  it('allows a second receipt to complete recovery and rejects over-recovery', async () => {
    prisma.placementClaimCashCall.findFirst.mockResolvedValue({
      ...cashCall,
      recoveryReceipts: [receipt],
    });
    prisma.placementClaimRecoveryReceipt.create.mockResolvedValue({
      ...receipt,
      id: 'receipt-2',
      amount: new Prisma.Decimal('60000.00'),
    });

    await service.create(user, 'placement-1', 'claim-1', 'cash-call-1', {
      currency: 'GHS',
      amount: 60000,
      paymentDate: '2026-07-30T12:00:00.000Z',
    });

    await expect(
      service.create(user, 'placement-1', 'claim-1', 'cash-call-1', {
        currency: 'GHS',
        amount: 60000.01,
        paymentDate: '2026-07-30T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects wrong currency and wrong scoped cash call', async () => {
    prisma.placementClaimCashCall.findFirst.mockResolvedValue(cashCall);

    await expect(
      service.create(user, 'placement-1', 'claim-1', 'cash-call-1', {
        currency: 'USD',
        amount: 1000,
        paymentDate: '2026-07-29T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.placementClaimCashCall.findFirst.mockResolvedValue(null);

    await expect(
      service.create(user, 'placement-1', 'claim-1', 'cash-call-1', {
        currency: 'GHS',
        amount: 1000,
        paymentDate: '2026-07-29T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reverses a receipt immutably and rejects duplicate reversal', async () => {
    prisma.placementClaimRecoveryReceipt.findFirst.mockResolvedValue(receipt);
    prisma.placementClaimRecoveryReceipt.update.mockResolvedValue({
      ...receipt,
      status: PlacementClaimRecoveryReceiptStatus.REVERSED,
    });
    prisma.placementClaimRecoveryReceipt.create.mockResolvedValue({
      ...receipt,
      id: 'receipt-reversal-1',
      reversalOfReceiptId: 'receipt-1',
    });

    await service.reverse(user, 'placement-1', 'claim-1', 'receipt-1', {
      notes: 'Correction',
    });

    expect(prisma.placementClaimRecoveryReceipt.update).toHaveBeenCalledWith({
      where: { id: 'receipt-1' },
      data: { status: PlacementClaimRecoveryReceiptStatus.REVERSED },
    });

    prisma.placementClaimRecoveryReceipt.findFirst.mockResolvedValue({
      ...receipt,
      status: PlacementClaimRecoveryReceiptStatus.REVERSED,
    });

    await expect(
      service.reverse(user, 'placement-1', 'claim-1', 'receipt-1', {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects reversing a reversal receipt', async () => {
    prisma.placementClaimRecoveryReceipt.findFirst.mockResolvedValue({
      ...receipt,
      reversalOfReceiptId: 'receipt-1',
    });

    await expect(
      service.reverse(user, 'placement-1', 'claim-1', 'receipt-reversal-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('builds recovery position totals independently per cash call', async () => {
    const reversedOriginal = {
      ...receipt,
      id: 'receipt-reversed-original',
      amount: new Prisma.Decimal('10000.00'),
      status: PlacementClaimRecoveryReceiptStatus.REVERSED,
    };
    const reversalRow = {
      ...receipt,
      id: 'receipt-reversal',
      amount: new Prisma.Decimal('10000.00'),
      reversalOfReceiptId: 'receipt-reversed-original',
    };
    prisma.placementClaimCashCall.findMany.mockResolvedValue([
      {
        ...cashCall,
        recoveryReceipts: [receipt, reversedOriginal, reversalRow],
      },
      {
        ...cashCall,
        id: 'cash-call-2',
        allocationId: 'allocation-2',
        counterpartyId: 'reinsurer-2',
        amount: new Prisma.Decimal('35000.00'),
        counterparty: { ...counterparty, id: 'reinsurer-2', name: 'B Re' },
        allocation: {
          id: 'allocation-2',
          allocatedEstimatedLossAmount: new Prisma.Decimal('35000.00'),
          allocatedFinalLossAmount: null,
        },
        recoveryReceipts: [],
      },
    ]);

    const position = await service.getRecoveryPosition(
      'tenant-1',
      'placement-1',
      'claim-1',
    );

    expect(position.recoveries).toEqual({
      totalAllocated: '135000.00',
      totalCashCalled: '135000.00',
      totalRecovered: '40000.00',
      totalReversed: '10000.00',
      totalOutstanding: '95000.00',
    });
    expect(position.perCashCall).toHaveLength(2);
    expect(position.perCashCall[0]).toMatchObject({
      recoveredAmount: '40000.00',
      reversedAmount: '10000.00',
      outstandingAmount: '60000.00',
      recoveryStatus: 'PARTIALLY_RECOVERED',
    });
    expect(position.perCashCall[1]).toMatchObject({
      recoveredAmount: '0.00',
      outstandingAmount: '35000.00',
      recoveryStatus: 'UNRECOVERED',
    });
  });
});
