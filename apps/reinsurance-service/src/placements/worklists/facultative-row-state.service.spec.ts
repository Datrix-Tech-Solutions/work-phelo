import {
  PlacementEndorsementStatus,
  PlacementPaymentStatus,
  PlacementPaymentType,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { ReinsuranceFacultativeRowStateService } from './facultative-row-state.service';

const TENANT_ID = 'tenant-1';
const PLACEMENT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PLACEMENT_ID = '22222222-2222-4222-8222-222222222222';
const CROSS_TENANT_ID = '33333333-3333-4333-8333-333333333333';

describe('ReinsuranceFacultativeRowStateService', () => {
  let prisma: {
    placement: { findMany: jest.Mock };
    placementClosing: { findMany: jest.Mock };
    placementEndorsementClosing: { findMany: jest.Mock };
    placementPayment: { findMany: jest.Mock };
    placementEndorsement: { groupBy: jest.Mock };
  };
  let service: ReinsuranceFacultativeRowStateService;

  beforeEach(() => {
    prisma = {
      placement: { findMany: jest.fn() },
      placementClosing: { findMany: jest.fn() },
      placementEndorsementClosing: { findMany: jest.fn() },
      placementPayment: { findMany: jest.fn() },
      placementEndorsement: { groupBy: jest.fn() },
    };
    service = new ReinsuranceFacultativeRowStateService(
      prisma as unknown as PrismaService,
      new ReinsuranceMoneyHelper(),
    );
    prisma.placement.findMany.mockResolvedValue([{ id: PLACEMENT_ID }]);
    prisma.placementClosing.findMany.mockResolvedValue([
      originalClosing(PLACEMENT_ID, 'participant-1', '100.00'),
    ]);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([]);
    prisma.placementPayment.findMany.mockResolvedValue([]);
    prisma.placementEndorsement.groupBy.mockResolvedValue([]);
  });

  it('returns an empty response without database work when no placementIds are provided', async () => {
    const result = await service.findRowState(TENANT_ID, {});

    expect(result).toEqual({ items: [] });
    expect(prisma.placement.findMany).not.toHaveBeenCalled();
  });

  it('rejects more than 100 placementIds', async () => {
    await expect(
      service.findRowState(TENANT_ID, {
        placementIds: Array.from(
          { length: 101 },
          (_, index) =>
            `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
        ),
      }),
    ).rejects.toThrow('A maximum of 100 placementIds is allowed.');
  });

  it('uses bounded tenant-scoped queries and omits unknown or cross-tenant placements', async () => {
    prisma.placement.findMany.mockResolvedValue([{ id: PLACEMENT_ID }]);

    const result = await service.findRowState(TENANT_ID, {
      placementIds: [PLACEMENT_ID, CROSS_TENANT_ID],
    });

    expect(prisma.placement.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_ID,
        archivedAt: null,
        id: { in: [PLACEMENT_ID, CROSS_TENANT_ID] },
      },
      select: { id: true },
    });
    const placementClosingFindMany = prisma.placementClosing
      .findMany as jest.MockedFunction<
      PrismaService['placementClosing']['findMany']
    >;

    const placementClosingArgs = placementClosingFindMany.mock.calls[0]?.[0];

    expect(placementClosingArgs?.where).toMatchObject({
      tenantId: TENANT_ID,
      placementId: { in: [PLACEMENT_ID] },
    });
    expect(result.items).toEqual([
      expect.objectContaining({ placementId: PLACEMENT_ID }),
    ]);
  });

  it('returns Outstanding when no premium payment has been recorded', async () => {
    const result = await service.findRowState(TENANT_ID, {
      placementIds: [PLACEMENT_ID],
    });

    expect(result.items[0]).toMatchObject({
      paymentStatus: 'Outstanding',
      hasRecordedPayment: false,
    });
  });

  it('returns Pending for a recorded premium receipt', async () => {
    prisma.placementPayment.findMany.mockResolvedValue([
      payment(PLACEMENT_ID, PlacementPaymentType.PREMIUM_RECEIVED, '40.00', {
        status: PlacementPaymentStatus.RECORDED,
      }),
    ]);

    const result = await service.findRowState(TENANT_ID, {
      placementIds: [PLACEMENT_ID],
    });

    expect(result.items[0]).toMatchObject({
      paymentStatus: 'Pending',
      hasRecordedPayment: true,
    });
  });

  it('returns Part Payment for a partial bank-confirmed premium receipt', async () => {
    prisma.placementPayment.findMany.mockResolvedValue([
      payment(PLACEMENT_ID, PlacementPaymentType.PREMIUM_RECEIVED, '40.00', {
        status: PlacementPaymentStatus.BANK_CONFIRMED,
      }),
    ]);

    const result = await service.findRowState(TENANT_ID, {
      placementIds: [PLACEMENT_ID],
    });

    expect(result.items[0]).toMatchObject({
      paymentStatus: 'Part Payment',
      hasRecordedPayment: false,
    });
  });

  it('returns Paid for a fully bank-confirmed premium receipt', async () => {
    prisma.placementPayment.findMany.mockResolvedValue([
      payment(PLACEMENT_ID, PlacementPaymentType.PREMIUM_RECEIVED, '100.00', {
        status: PlacementPaymentStatus.BANK_CONFIRMED,
      }),
    ]);

    const result = await service.findRowState(TENANT_ID, {
      placementIds: [PLACEMENT_ID],
    });

    expect(result.items[0]).toMatchObject({ paymentStatus: 'Paid' });
  });

  it('matches existing reversal behavior by ignoring reversal child rows for payment status', async () => {
    prisma.placementPayment.findMany.mockResolvedValue([
      payment(PLACEMENT_ID, PlacementPaymentType.PREMIUM_RECEIVED, '100.00', {
        status: PlacementPaymentStatus.BANK_CONFIRMED,
        reversalOfPaymentId: 'original-payment-1',
      }),
    ]);

    const result = await service.findRowState(TENANT_ID, {
      placementIds: [PLACEMENT_ID],
    });

    expect(result.items[0]).toMatchObject({ paymentStatus: 'Outstanding' });
  });

  it('preserves the RECORDED-only hasRecordedPayment behavior across payment types', async () => {
    prisma.placementPayment.findMany.mockResolvedValue([
      payment(
        PLACEMENT_ID,
        PlacementPaymentType.REINSURER_DISBURSEMENT,
        '10.00',
        { status: PlacementPaymentStatus.RECORDED },
      ),
      payment(PLACEMENT_ID, PlacementPaymentType.PREMIUM_RECEIVED, '100.00', {
        status: PlacementPaymentStatus.BANK_CONFIRMED,
      }),
    ]);

    const result = await service.findRowState(TENANT_ID, {
      placementIds: [PLACEMENT_ID],
    });

    expect(result.items[0]).toMatchObject({
      paymentStatus: 'Paid',
      hasRecordedPayment: true,
    });
  });

  it('returns false endorsement state when there are no non-VOID endorsements', async () => {
    const result = await service.findRowState(TENANT_ID, {
      placementIds: [PLACEMENT_ID],
    });

    expect(result.items[0]).toMatchObject({
      nonVoidEndorsementCount: 0,
      hasNonVoidEndorsement: false,
    });
  });

  it('counts only non-VOID endorsements', async () => {
    prisma.placementEndorsement.groupBy.mockResolvedValue([
      { placementId: PLACEMENT_ID, _count: { _all: 2 } },
    ]);

    const result = await service.findRowState(TENANT_ID, {
      placementIds: [PLACEMENT_ID],
    });

    expect(prisma.placementEndorsement.groupBy).toHaveBeenCalledWith({
      by: ['placementId'],
      where: {
        tenantId: TENANT_ID,
        placementId: { in: [PLACEMENT_ID] },
        status: { not: PlacementEndorsementStatus.VOID },
      },
      _count: { _all: true },
    });
    expect(result.items[0]).toMatchObject({
      nonVoidEndorsementCount: 2,
      hasNonVoidEndorsement: true,
    });
  });

  it('returns mixed placement row states in requested order', async () => {
    prisma.placement.findMany.mockResolvedValue([
      { id: PLACEMENT_ID },
      { id: OTHER_PLACEMENT_ID },
    ]);
    prisma.placementClosing.findMany.mockResolvedValue([
      originalClosing(PLACEMENT_ID, 'participant-1', '100.00'),
      originalClosing(OTHER_PLACEMENT_ID, 'participant-2', '200.00'),
    ]);
    prisma.placementPayment.findMany.mockResolvedValue([
      payment(
        OTHER_PLACEMENT_ID,
        PlacementPaymentType.PREMIUM_RECEIVED,
        '200.00',
        {
          status: PlacementPaymentStatus.BANK_CONFIRMED,
        },
      ),
    ]);
    prisma.placementEndorsement.groupBy.mockResolvedValue([
      { placementId: PLACEMENT_ID, _count: { _all: 1 } },
    ]);

    const result = await service.findRowState(TENANT_ID, {
      placementIds: [OTHER_PLACEMENT_ID, PLACEMENT_ID],
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        placementId: OTHER_PLACEMENT_ID,
        paymentStatus: 'Paid',
        hasNonVoidEndorsement: false,
      }),
      expect.objectContaining({
        placementId: PLACEMENT_ID,
        paymentStatus: 'Outstanding',
        hasNonVoidEndorsement: true,
      }),
    ]);
  });

  it('uses effective endorsement closing snapshots when deriving current obligation', async () => {
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        id: 'endorsement-closing-1',
        placementId: PLACEMENT_ID,
        endorsementParticipantId: 'endorsement-participant-1',
        premiumSnapshot: '150.00',
        commissionAmount: '0.00',
        netPremium: '150.00',
        createdAt: new Date('2026-08-20T12:00:00.000Z'),
        endorsementId: 'endorsement-1',
        endorsement: {
          effectiveDate: new Date('2026-08-20T00:00:00.000Z'),
          createdAt: new Date('2026-08-20T09:00:00.000Z'),
        },
        endorsementParticipant: {
          originalParticipantId: 'participant-1',
        },
      },
    ]);
    prisma.placementPayment.findMany.mockResolvedValue([
      payment(PLACEMENT_ID, PlacementPaymentType.PREMIUM_RECEIVED, '100.00', {
        status: PlacementPaymentStatus.BANK_CONFIRMED,
      }),
    ]);

    const result = await service.findRowState(TENANT_ID, {
      placementIds: [PLACEMENT_ID],
    });

    expect(result.items[0]).toMatchObject({ paymentStatus: 'Part Payment' });
  });
});

function originalClosing(
  placementId: string,
  participantId: string,
  grossPremium: string,
) {
  return {
    id: `closing-${participantId}`,
    placementId,
    participantId,
    grossPremium,
    commissionAmount: '0.00',
    netPremium: grossPremium,
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
  };
}

function payment(
  placementId: string,
  type: PlacementPaymentType,
  amount: string,
  overrides: Partial<{
    status: PlacementPaymentStatus;
    reversalOfPaymentId: string | null;
  }> = {},
) {
  return {
    placementId,
    type,
    amount,
    status: overrides.status ?? PlacementPaymentStatus.RECORDED,
    reversalOfPaymentId: overrides.reversalOfPaymentId ?? null,
  };
}
