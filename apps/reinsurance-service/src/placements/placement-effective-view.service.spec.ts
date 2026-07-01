import {
  CounterpartyType,
  PlacementClosingStatus,
  PlacementEndorsementImpactType,
  PlacementEndorsementStatus,
  PlacementEndorsementType,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClosingSnapshotReader } from './closing-snapshot.reader';
import { PlacementEffectiveViewService } from './placement-effective-view.service';
import { ReinsuranceMoneyHelper } from './reinsurance-money.helper';

describe('PlacementEffectiveViewService', () => {
  const tenantId = 'tenant-1';
  const placementId = 'placement-1';

  const placement = {
    id: placementId,
    reference: 'POL/UTC/MC/001',
    title: 'Factory Fire',
    cedantId: 'cedant-1',
    currency: 'USD',
    sumInsured: '1000000.00',
    premium: '100000.00',
    commission: '10.0000',
    facultativeOffer: '60.0000',
    preliminaryBrokerage: '7.5000',
  };

  const placementSnapshots = [
    {
      sourceType: 'PLACEMENT_CLOSING' as const,
      closingId: 'closing-a',
      participantId: 'participant-a',
      counterpartyId: 'reinsurer-a',
      signedLinePercent: 40,
      premium: 40000,
      commissionPercent: 10,
      commissionAmount: 4000,
      brokeragePercent: 7.5,
      brokerageAmount: 3000,
      netPremium: 33000,
      currency: 'USD',
    },
    {
      sourceType: 'PLACEMENT_CLOSING' as const,
      closingId: 'closing-b',
      participantId: 'participant-b',
      counterpartyId: 'reinsurer-b',
      signedLinePercent: 20,
      premium: 20000,
      commissionPercent: 10,
      commissionAmount: 2000,
      brokeragePercent: 7.5,
      brokerageAmount: 1500,
      netPremium: 16500,
      currency: 'USD',
    },
  ];

  const counterpartyRows = [
    {
      id: 'reinsurer-a',
      type: CounterpartyType.REINSURER,
      name: 'Avenue Re',
      registrationNumber: null,
    },
    {
      id: 'reinsurer-b',
      type: CounterpartyType.REINSURER,
      name: 'Bridge Re',
      registrationNumber: null,
    },
    {
      id: 'reinsurer-c',
      type: CounterpartyType.REINSURER,
      name: 'Cedar Re',
      registrationNumber: 'CED-001',
    },
  ];

  const makeConfirmedEndorsement = (
    overrides: Partial<Record<string, unknown>> = {},
  ) =>
    ({
      id: 'endorsement-1',
      endorsementNumber: 'END-001',
      type: PlacementEndorsementType.PARTICIPANT_ADDITION,
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
      status: PlacementEndorsementStatus.CLOSING,
      effectiveDate: new Date('2026-06-10T00:00:00.000Z'),
      targetPercent: '70.0000',
      proposedSnapshot: {
        sumInsured: '1500000.00',
        premium: '150000.00',
        commission: '10.0000',
        preliminaryBrokerage: '7.5000',
        currency: 'USD',
        facultativeOffer: '70.0000',
      },
      closings: [
        {
          id: 'endorsement-closing-1',
          closingNumber: 'ENC-001',
          status: PlacementClosingStatus.CONFIRMED,
          endorsementParticipantId: 'endorsement-participant-1',
          signedLinePercent: '10.0000',
          endorsementParticipant: { counterpartyId: 'reinsurer-c' },
        },
      ],
      ...overrides,
    }) as never;

  let tx: {
    placement: { findFirst: jest.Mock };
    placementEndorsement: { findMany: jest.Mock };
    counterparty: { findMany: jest.Mock };
    placementClosing: { update: jest.Mock; create: jest.Mock };
    placementParticipant: { update: jest.Mock };
    placementEndorsementClosing: { update: jest.Mock; create: jest.Mock };
    placementNote: { update: jest.Mock; create: jest.Mock };
  };
  let prisma: { $transaction: jest.Mock };
  let closingSnapshotReader: {
    findConfirmedPlacementClosingSnapshots: jest.Mock;
    findConfirmedEndorsementClosingSnapshots: jest.Mock;
  };
  let service: PlacementEffectiveViewService;

  beforeEach(() => {
    tx = {
      placement: { findFirst: jest.fn().mockResolvedValue(placement) },
      placementEndorsement: { findMany: jest.fn().mockResolvedValue([]) },
      counterparty: { findMany: jest.fn().mockResolvedValue(counterpartyRows) },
      placementClosing: { update: jest.fn(), create: jest.fn() },
      placementParticipant: { update: jest.fn() },
      placementEndorsementClosing: { update: jest.fn(), create: jest.fn() },
      placementNote: { update: jest.fn(), create: jest.fn() },
    };
    const runTransaction = <T>(
      callback: (transaction: typeof tx) => Promise<T>,
    ): Promise<T> => callback(tx);
    prisma = {
      $transaction: jest.fn(runTransaction),
    };
    closingSnapshotReader = {
      findConfirmedPlacementClosingSnapshots: jest
        .fn()
        .mockResolvedValue(placementSnapshots),
      findConfirmedEndorsementClosingSnapshots: jest.fn().mockResolvedValue([]),
    };
    service = new PlacementEffectiveViewService(
      prisma as unknown as PrismaService,
      closingSnapshotReader as unknown as ClosingSnapshotReader,
      new ReinsuranceMoneyHelper(),
    );
  });

  it('returns original confirmed position when placement has no endorsements', async () => {
    const result = await service.getEffectiveView(tenantId, placementId);

    expect(tx.placement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: placementId, tenantId, archivedAt: null },
      }),
    );
    expect(result.effectiveTotals.facultativeOfferPercent).toBe(60);
    expect(result.effectiveTotals.grossPremium).toBe(60000);
    expect(result.effectiveParticipants).toHaveLength(2);
    expect(result.appliedEndorsements).toEqual([]);
    expect(result.pendingEndorsements).toEqual([]);
  });

  it('adds a capacity increase endorsement delta to the effective share', async () => {
    closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
      [
        {
          sourceType: 'ENDORSEMENT_CLOSING',
          closingId: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          counterpartyId: 'reinsurer-c',
          signedLinePercent: 10,
          premium: 15000,
          commissionPercent: 10,
          commissionAmount: 1500,
          brokeragePercent: 7.5,
          brokerageAmount: 1125,
          netPremium: 12375,
          currency: 'USD',
        },
      ],
    );
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement(),
    ]);

    const result = await service.getEffectiveView(tenantId, placementId);

    expect(result.effectiveTotals.facultativeOfferPercent).toBe(70);
    expect(result.effectiveTotals.sumInsured).toBe(1500000);
    expect(result.effectiveTotals.premium).toBe(150000);
    expect(result.effectiveParticipants).toHaveLength(3);
    expect(result.appliedEndorsements).toHaveLength(1);
    expect(result.appliedEndorsements[0].confirmedClosings[0]).toMatchObject({
      id: 'endorsement-closing-1',
      counterpartyId: 'reinsurer-c',
      signedLinePercent: 10,
    });
  });

  it('aggregates an existing reinsurer taking an endorsement delta', async () => {
    closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
      [
        {
          sourceType: 'ENDORSEMENT_CLOSING',
          closingId: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          originalParticipantId: 'participant-a',
          counterpartyId: 'reinsurer-a',
          signedLinePercent: 50,
          premium: 75000,
          commissionPercent: 10,
          commissionAmount: 7500,
          brokeragePercent: 7.5,
          brokerageAmount: 5625,
          netPremium: 61875,
          currency: 'USD',
        },
      ],
    );
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement({
        closings: [
          {
            id: 'endorsement-closing-1',
            closingNumber: 'ENC-001',
            status: PlacementClosingStatus.CONFIRMED,
            endorsementParticipantId: 'endorsement-participant-1',
            signedLinePercent: '50.0000',
            endorsementParticipant: { counterpartyId: 'reinsurer-a' },
          },
        ],
      }),
    ]);

    const result = await service.getEffectiveView(tenantId, placementId);
    const avenue = result.effectiveParticipants.find(
      (participant) => participant.counterpartyId === 'reinsurer-a',
    );

    expect(avenue?.signedLinePercent).toBe(50);
    expect(avenue?.sources).toEqual([
      expect.objectContaining({
        sourceType: 'ENDORSEMENT_CLOSING',
        signedLinePercent: 50,
      }),
    ]);
  });

  it('replaces an absolute revised facultative offer instead of adding it to the base', async () => {
    tx.placement.findFirst.mockResolvedValue({
      ...placement,
      facultativeOffer: '40.0000',
    });
    closingSnapshotReader.findConfirmedPlacementClosingSnapshots.mockResolvedValue(
      [placementSnapshots[0]],
    );
    closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
      [
        {
          sourceType: 'ENDORSEMENT_CLOSING',
          closingId: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          originalParticipantId: 'participant-a',
          counterpartyId: 'reinsurer-a',
          signedLinePercent: 45,
          premium: 45000,
          commissionPercent: 10,
          commissionAmount: 4500,
          brokeragePercent: 7.5,
          brokerageAmount: 3375,
          netPremium: 37125,
          currency: 'USD',
        },
      ],
    );
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement({
        targetPercent: '5.0000',
        proposedSnapshot: {
          facultativeOffer: '45.0000',
          premium: '100000.00',
          currency: 'USD',
        },
        closings: [
          {
            id: 'endorsement-closing-1',
            closingNumber: 'ENC-001',
            status: PlacementClosingStatus.CONFIRMED,
            endorsementParticipantId: 'endorsement-participant-1',
            signedLinePercent: '45.0000',
            endorsementParticipant: { counterpartyId: 'reinsurer-a' },
          },
        ],
      }),
    ]);

    const result = await service.getEffectiveView(tenantId, placementId);

    expect(result.basePlacement.facultativeOfferPercent).toBe(40);
    expect(result.effectiveTotals.facultativeOfferPercent).toBe(45);
    expect(result.effectiveTotals.facultativeOfferPercent).not.toBe(85);
    expect(result.effectiveParticipants).toEqual([
      expect.objectContaining({
        counterpartyId: 'reinsurer-a',
        signedLinePercent: 45,
      }),
    ]);
  });

  it('applies multiple absolute endorsement revisions in chronological order', async () => {
    tx.placement.findFirst.mockResolvedValue({
      ...placement,
      facultativeOffer: '40.0000',
    });
    closingSnapshotReader.findConfirmedPlacementClosingSnapshots.mockResolvedValue(
      [placementSnapshots[0]],
    );
    closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
      [
        {
          sourceType: 'ENDORSEMENT_CLOSING',
          closingId: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          originalParticipantId: 'participant-a',
          counterpartyId: 'reinsurer-a',
          signedLinePercent: 45,
          premium: 45000,
          commissionPercent: 10,
          commissionAmount: 4500,
          brokeragePercent: 7.5,
          brokerageAmount: 3375,
          netPremium: 37125,
          currency: 'USD',
        },
        {
          sourceType: 'ENDORSEMENT_CLOSING',
          closingId: 'endorsement-closing-2',
          endorsementParticipantId: 'endorsement-participant-2',
          originalParticipantId: 'participant-a',
          counterpartyId: 'reinsurer-a',
          signedLinePercent: 50,
          premium: 60000,
          commissionPercent: 10,
          commissionAmount: 6000,
          brokeragePercent: 7.5,
          brokerageAmount: 4500,
          netPremium: 49500,
          currency: 'USD',
        },
      ],
    );
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement({
        proposedSnapshot: {
          facultativeOffer: '45.0000',
          premium: '110000.00',
        },
      }),
      makeConfirmedEndorsement({
        id: 'endorsement-2',
        endorsementNumber: 'END-002',
        effectiveDate: new Date('2026-06-20T00:00:00.000Z'),
        proposedSnapshot: {
          facultativeOffer: '50.0000',
          premium: '120000.00',
        },
        closings: [
          {
            id: 'endorsement-closing-2',
            closingNumber: 'ENC-002',
            status: PlacementClosingStatus.CONFIRMED,
            endorsementParticipantId: 'endorsement-participant-2',
            signedLinePercent: '50.0000',
            endorsementParticipant: { counterpartyId: 'reinsurer-a' },
          },
        ],
      }),
    ]);

    const result = await service.getEffectiveView(tenantId, placementId);

    expect(result.effectiveTotals.facultativeOfferPercent).toBe(50);
    expect(result.effectiveTotals.premium).toBe(120000);
    expect(result.effectiveParticipants).toEqual([
      expect.objectContaining({
        counterpartyId: 'reinsurer-a',
        signedLinePercent: 50,
      }),
    ]);
  });

  it('does not apply unconfirmed endorsement closings and reports them as pending', async () => {
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement({
        id: 'endorsement-2',
        endorsementNumber: 'END-002',
        status: PlacementEndorsementStatus.MARKETING,
        closings: [
          {
            id: 'endorsement-closing-2',
            closingNumber: 'ENC-002',
            status: PlacementClosingStatus.ISSUED,
            endorsementParticipantId: 'endorsement-participant-2',
            signedLinePercent: '10.0000',
            endorsementParticipant: { counterpartyId: 'reinsurer-c' },
          },
        ],
      }),
    ]);

    const result = await service.getEffectiveView(tenantId, placementId);

    expect(result.effectiveTotals.facultativeOfferPercent).toBe(60);
    expect(result.effectiveParticipants).toHaveLength(2);
    expect(result.appliedEndorsements).toEqual([]);
    expect(result.pendingEndorsements).toEqual([
      expect.objectContaining({
        id: 'endorsement-2',
        endorsementNumber: 'END-002',
        status: PlacementEndorsementStatus.MARKETING,
      }),
    ]);
  });

  it('does not apply confirmed closings from void endorsements', async () => {
    closingSnapshotReader.findConfirmedEndorsementClosingSnapshots.mockResolvedValue(
      [
        {
          sourceType: 'ENDORSEMENT_CLOSING',
          closingId: 'endorsement-closing-1',
          endorsementParticipantId: 'endorsement-participant-1',
          counterpartyId: 'reinsurer-c',
          signedLinePercent: 10,
          premium: 15000,
          commissionPercent: 10,
          commissionAmount: 1500,
          brokeragePercent: 7.5,
          brokerageAmount: 1125,
          netPremium: 12375,
          currency: 'USD',
        },
      ],
    );
    tx.placementEndorsement.findMany.mockResolvedValue([
      makeConfirmedEndorsement({
        status: PlacementEndorsementStatus.VOID,
      }),
    ]);

    const result = await service.getEffectiveView(tenantId, placementId);

    expect(result.effectiveTotals.facultativeOfferPercent).toBe(60);
    expect(result.effectiveParticipants).toHaveLength(2);
    expect(result.appliedEndorsements).toEqual([]);
    expect(result.pendingEndorsements).toEqual([]);
  });

  it.each([
    PlacementEndorsementImpactType.TERMS_ONLY,
    PlacementEndorsementImpactType.ADMINISTRATIVE,
  ])(
    'applies a closed %s endorsement without inventing capacity closings',
    async (impactType) => {
      tx.placementEndorsement.findMany.mockResolvedValue([
        makeConfirmedEndorsement({
          type: PlacementEndorsementType.PREMIUM_ADJUSTMENT,
          impactType,
          status: PlacementEndorsementStatus.CLOSED,
          targetPercent: null,
          proposedSnapshot: {
            premium: '120000.00',
            currency: 'USD',
          },
          closings: [],
        }),
      ]);

      const result = await service.getEffectiveView(tenantId, placementId);

      expect(result.effectiveTotals.premium).toBe(120000);
      expect(result.effectiveTotals.facultativeOfferPercent).toBe(60);
      expect(result.effectiveParticipants).toHaveLength(2);
      expect(result.appliedEndorsements).toHaveLength(1);
      expect(result.appliedEndorsements[0].confirmedClosings).toEqual([]);
      expect(result.pendingEndorsements).toEqual([]);
      expect(result.warnings).toContain(
        'Closed non-capacity endorsement terms are applied to the effective placement fields; closing-derived premium amounts remain based on confirmed closing snapshots.',
      );
    },
  );

  it('does not mutate placement, closings, notes or participants', async () => {
    await service.getEffectiveView(tenantId, placementId);

    expect(tx.placementClosing.update).not.toHaveBeenCalled();
    expect(tx.placementClosing.create).not.toHaveBeenCalled();
    expect(tx.placementParticipant.update).not.toHaveBeenCalled();
    expect(tx.placementEndorsementClosing.update).not.toHaveBeenCalled();
    expect(tx.placementEndorsementClosing.create).not.toHaveBeenCalled();
    expect(tx.placementNote.update).not.toHaveBeenCalled();
    expect(tx.placementNote.create).not.toHaveBeenCalled();
  });
});
