import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  CounterpartyType,
  PlacementClosingStatus,
  PlacementEndorsementImpactType,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  PlacementPaymentType,
  PlacementStatus,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlacementFinancialActivityReader } from './placement-financial-activity.reader';
import { PlacementFinancialLockPolicy } from './placement-financial-lock.policy';
import { PlacementNotesService } from './placement-notes.service';

describe('PlacementNotesService', () => {
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
    cedantId: 'cedant-1',
    currency: 'USD',
  };

  const note = {
    id: 'note-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    closingId: null,
    participantId: null,
    counterpartyId: 'cedant-1',
    settledByPaymentId: null,
    type: PlacementNoteType.DEBIT_NOTE,
    direction: PlacementNoteDirection.CEDANT_TO_BROKER,
    noteNumber: 'DN-001',
    status: PlacementNoteStatus.DRAFT,
    currency: 'USD',
    grossAmount: new Prisma.Decimal('7500.00'),
    commissionPercent: null,
    commissionAmount: new Prisma.Decimal('750.00'),
    brokeragePercent: null,
    brokerageAmount: null,
    nicLevyPercent: new Prisma.Decimal('0.0000'),
    nicLevyAmount: new Prisma.Decimal('0.00'),
    withholdingTaxPercent: new Prisma.Decimal('0.0000'),
    withholdingTaxAmount: new Prisma.Decimal('0.00'),
    netAmount: new Prisma.Decimal('6750.00'),
    noteDate: new Date('2026-06-04T12:00:00.000Z'),
    issuedAt: null,
    voidedAt: null,
    voidReason: null,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-06-04T12:00:00.000Z'),
    updatedAt: new Date('2026-06-04T12:00:00.000Z'),
    counterparty: {
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
      name: 'Acme Insurance',
      registrationNumber: null,
    },
    participant: null,
    closing: null,
    endorsementId: null,
    endorsementClosingId: null,
    endorsementParticipantId: null,
    endorsementParticipant: null,
    endorsementClosing: null,
  };

  const confirmedClosing = {
    id: 'closing-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    participantId: 'participant-1',
    closingNumber: 'CLO-001',
    status: PlacementClosingStatus.CONFIRMED,
    signedLinePercent: new Prisma.Decimal('30.0000'),
    sharePercent: new Prisma.Decimal('40.0000'),
    grossPremium: new Prisma.Decimal('4500.00'),
    commissionPercent: new Prisma.Decimal('10.0000'),
    commissionAmount: new Prisma.Decimal('450.00'),
    brokeragePercent: new Prisma.Decimal('7.50'),
    brokerageAmount: new Prisma.Decimal('337.50'),
    netPremium: new Prisma.Decimal('3712.50'),
    currency: 'USD',
    issuedAt: new Date('2026-06-04T10:00:00.000Z'),
    confirmedAt: new Date('2026-06-04T11:00:00.000Z'),
    createdByUserId: 'user-1',
    createdAt: new Date('2026-06-04T09:00:00.000Z'),
    updatedAt: new Date('2026-06-04T11:00:00.000Z'),
    participant: {
      id: 'participant-1',
      counterpartyId: 'reinsurer-1',
      counterparty: {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
      },
    },
  };

  const confirmedEndorsementClosing = {
    id: 'endorsement-closing-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    endorsementId: 'endorsement-1',
    endorsementParticipantId: 'endorsement-participant-1',
    closingNumber: 'ENC-001',
    status: PlacementClosingStatus.CONFIRMED,
    signedLinePercent: new Prisma.Decimal('10.0000'),
    sharePercent: new Prisma.Decimal('10.0000'),
    sumInsuredSnapshot: new Prisma.Decimal('100000.00'),
    premiumSnapshot: new Prisma.Decimal('1500.00'),
    commissionPercent: new Prisma.Decimal('10.0000'),
    commissionAmount: new Prisma.Decimal('150.00'),
    brokeragePercent: new Prisma.Decimal('7.50'),
    brokerageAmount: new Prisma.Decimal('112.50'),
    netPremium: new Prisma.Decimal('1237.50'),
    currency: 'USD',
    issuedAt: new Date('2026-06-05T10:00:00.000Z'),
    confirmedAt: new Date('2026-06-05T11:00:00.000Z'),
    createdByUserId: 'user-1',
    createdAt: new Date('2026-06-05T09:00:00.000Z'),
    updatedAt: new Date('2026-06-05T11:00:00.000Z'),
    endorsementParticipant: {
      id: 'endorsement-participant-1',
      counterpartyId: 'reinsurer-1',
      counterparty: {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
      },
    },
  };

  let prisma: {
    placement: { findFirst: PrismaMethod };
    placementClosing: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
    };
    placementEndorsement: { findFirst: PrismaMethod };
    placementEndorsementClosing: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
    };
    placementNote: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      count: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    placementPayment: { findFirst: PrismaMethod };
    $transaction: jest.Mock;
  };
  let service: PlacementNotesService;
  let lockPolicy: PlacementFinancialLockPolicy;

  beforeEach(() => {
    prisma = {
      placement: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClosing: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsement: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsementClosing: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementNote: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        count: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementPayment: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    service = new PlacementNotesService(prisma as unknown as PrismaService);
    lockPolicy = new PlacementFinancialLockPolicy(
      new PlacementFinancialActivityReader(prisma as unknown as PrismaService),
    );
  });

  it('lists notes for an active tenant placement', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findMany.mockResolvedValue([note]);

    const result = await service.findAll('tenant-1', 'placement-1');

    expect(prisma.placementNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', placementId: 'placement-1' },
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('does not expose another tenant placement notes', async () => {
    prisma.placement.findFirst.mockResolvedValue(null);

    await expect(service.findAll('tenant-1', 'placement-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates debit note from confirmed closing snapshots', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findMany.mockResolvedValue([
      {
        grossPremium: new Prisma.Decimal('4500.00'),
        commissionAmount: new Prisma.Decimal('450.00'),
        currency: 'USD',
      },
      {
        grossPremium: new Prisma.Decimal('3000.00'),
        commissionAmount: new Prisma.Decimal('300.00'),
        currency: 'USD',
      },
    ]);
    prisma.placementNote.count.mockResolvedValue(0);
    prisma.placementNote.create.mockResolvedValue(note);

    const result = await service.createDebitNote(user, 'placement-1');

    const createArgs = firstCallArg<Prisma.PlacementNoteCreateArgs>(
      prisma.placementNote.create,
    );
    expect(createArgs.data).toMatchObject({
      placementId: 'placement-1',
      counterpartyId: 'cedant-1',
      type: PlacementNoteType.DEBIT_NOTE,
      direction: PlacementNoteDirection.CEDANT_TO_BROKER,
      noteNumber: 'DN-001',
      grossAmount: 7500,
      commissionAmount: 750,
      brokerageAmount: null,
      nicLevyAmount: 0,
      withholdingTaxAmount: 0,
      netAmount: 6750,
    });
    expect(result.noteNumber).toBe('DN-001');
  });

  it('allows locked placements to generate notes from confirmed closings without unlocking them', async () => {
    const lockedPlacement = {
      id: 'placement-1',
      tenantId: 'tenant-1',
      status: PlacementStatus.MARKETING,
    };
    const paymentDate = new Date('2026-06-04T13:00:00.000Z');
    prisma.placementPayment.findFirst.mockResolvedValue({
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      paymentDate,
      createdAt: paymentDate,
    });
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findMany.mockResolvedValue([
      {
        grossPremium: new Prisma.Decimal('4500.00'),
        commissionAmount: new Prisma.Decimal('450.00'),
        currency: 'USD',
      },
    ]);
    prisma.placementNote.count.mockResolvedValue(0);
    prisma.placementNote.create.mockResolvedValue(note);

    await expect(lockPolicy.evaluate(lockedPlacement)).resolves.toMatchObject({
      locked: true,
      endorsementRequired: true,
      lockSource: 'PREMIUM_PAYMENT',
    });

    await expect(
      service.createDebitNote(user, 'placement-1'),
    ).resolves.toMatchObject({
      id: 'note-1',
      noteNumber: 'DN-001',
      type: PlacementNoteType.DEBIT_NOTE,
    });

    await expect(lockPolicy.evaluate(lockedPlacement)).resolves.toMatchObject({
      locked: true,
      endorsementRequired: true,
      lockSource: 'PREMIUM_PAYMENT',
    });
  });

  it('rejects debit note when no confirmed closing exists', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findMany.mockResolvedValue([]);

    await expect(service.createDebitNote(user, 'placement-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects duplicate active debit note and allows reissue after VOID', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst
      .mockResolvedValueOnce({ id: 'active-note' })
      .mockResolvedValueOnce(null);

    await expect(service.createDebitNote(user, 'placement-1')).rejects.toThrow(
      ConflictException,
    );

    prisma.placementClosing.findMany.mockResolvedValue([
      {
        grossPremium: new Prisma.Decimal('4500.00'),
        commissionAmount: new Prisma.Decimal('450.00'),
        currency: 'USD',
      },
    ]);
    prisma.placementNote.count.mockResolvedValue(1);
    prisma.placementNote.create.mockResolvedValue({
      ...note,
      noteNumber: 'DN-002',
    });

    const result = await service.createDebitNote(user, 'placement-1');

    expect(result.noteNumber).toBe('DN-002');
  });

  it('creates credit note from a confirmed closing snapshot', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findFirst.mockResolvedValue(confirmedClosing);
    prisma.placementNote.count.mockResolvedValue(0);
    prisma.placementNote.create.mockResolvedValue({
      ...note,
      id: 'credit-note-1',
      closingId: 'closing-1',
      participantId: 'participant-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementNoteType.CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      noteNumber: 'CN-001',
      grossAmount: new Prisma.Decimal('4500.00'),
      commissionPercent: new Prisma.Decimal('10.0000'),
      commissionAmount: new Prisma.Decimal('450.00'),
      brokeragePercent: new Prisma.Decimal('7.50'),
      brokerageAmount: new Prisma.Decimal('337.50'),
      netAmount: new Prisma.Decimal('3712.50'),
    });

    await service.createCreditNote(user, 'placement-1', 'closing-1');

    const createArgs = firstCallArg<Prisma.PlacementNoteCreateArgs>(
      prisma.placementNote.create,
    );
    expect(createArgs.data).toMatchObject({
      placementId: 'placement-1',
      closingId: 'closing-1',
      participantId: 'participant-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementNoteType.CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      noteNumber: 'CN-001',
      grossAmount: 4500,
      commissionPercent: 10,
      commissionAmount: 450,
      brokeragePercent: 7.5,
      brokerageAmount: 337.5,
      netAmount: 3712.5,
    });
  });

  it('rejects credit note for non-confirmed or wrong-tenant closing', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementClosing.findFirst.mockResolvedValue(null);

    await expect(
      service.createCreditNote(user, 'placement-1', 'closing-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate active credit note and allows reissue after VOID', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst
      .mockResolvedValueOnce({ id: 'active-note' })
      .mockResolvedValueOnce(null);

    await expect(
      service.createCreditNote(user, 'placement-1', 'closing-1'),
    ).rejects.toThrow(ConflictException);

    prisma.placementClosing.findFirst.mockResolvedValue(confirmedClosing);
    prisma.placementNote.count.mockResolvedValue(1);
    prisma.placementNote.create.mockResolvedValue({
      ...note,
      type: PlacementNoteType.CREDIT_NOTE,
      noteNumber: 'CN-002',
    });

    const result = await service.createCreditNote(
      user,
      'placement-1',
      'closing-1',
    );

    expect(result.noteNumber).toBe('CN-002');
  });

  it('creates endorsement debit note from confirmed endorsement closing snapshots', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
    });
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        premiumSnapshot: new Prisma.Decimal('1500.00'),
        commissionAmount: new Prisma.Decimal('150.00'),
        currency: 'USD',
      },
      {
        premiumSnapshot: new Prisma.Decimal('500.00'),
        commissionAmount: new Prisma.Decimal('50.00'),
        currency: 'USD',
      },
    ]);
    prisma.placementNote.count.mockResolvedValue(0);
    prisma.placementNote.create.mockResolvedValue({
      ...note,
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      noteNumber: 'EDN-001',
      endorsementId: 'endorsement-1',
      grossAmount: new Prisma.Decimal('2000.00'),
      commissionAmount: new Prisma.Decimal('200.00'),
      netAmount: new Prisma.Decimal('1800.00'),
    });

    const result = await service.createEndorsementDebitNote(
      user,
      'placement-1',
      'endorsement-1',
    );

    const createArgs = firstCallArg<Prisma.PlacementNoteCreateArgs>(
      prisma.placementNote.create,
    );
    expect(createArgs.data).toMatchObject({
      placementId: 'placement-1',
      endorsementId: 'endorsement-1',
      counterpartyId: 'cedant-1',
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      direction: PlacementNoteDirection.CEDANT_TO_BROKER,
      noteNumber: 'EDN-001',
      grossAmount: 2000,
      commissionAmount: 200,
      brokerageAmount: null,
      netAmount: 1800,
    });
    expect(result.noteNumber).toBe('EDN-001');
  });

  it('rejects endorsement debit note when no confirmed endorsement closing exists', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
    });
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([]);

    await expect(
      service.createEndorsementDebitNote(user, 'placement-1', 'endorsement-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects endorsement debit note for decrease or cancellation endorsements', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
      impactType: PlacementEndorsementImpactType.DECREASE_OR_CANCELLATION,
    });

    await expect(
      service.createEndorsementDebitNote(user, 'placement-1', 'endorsement-1'),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.placementNote.create).not.toHaveBeenCalled();
  });

  it('rejects endorsement debit note when confirmed closing snapshots have mixed currencies', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
    });
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        premiumSnapshot: new Prisma.Decimal('1500.00'),
        commissionAmount: new Prisma.Decimal('150.00'),
        currency: 'USD',
      },
      {
        premiumSnapshot: new Prisma.Decimal('500.00'),
        commissionAmount: new Prisma.Decimal('50.00'),
        currency: 'GHS',
      },
    ]);

    await expect(
      service.createEndorsementDebitNote(user, 'placement-1', 'endorsement-1'),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.placementNote.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate active endorsement debit note', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
    });
    prisma.placementNote.findFirst.mockResolvedValue({ id: 'active-note' });

    await expect(
      service.createEndorsementDebitNote(user, 'placement-1', 'endorsement-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('allows endorsement debit note regeneration after VOID and preserves numbering history', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
      impactType: PlacementEndorsementImpactType.CAPACITY_INCREASE,
    });
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementClosing.findMany.mockResolvedValue([
      {
        premiumSnapshot: new Prisma.Decimal('1500.00'),
        commissionAmount: new Prisma.Decimal('150.00'),
        currency: 'USD',
      },
    ]);
    prisma.placementNote.count.mockResolvedValue(1);
    prisma.placementNote.create.mockResolvedValue({
      ...note,
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      noteNumber: 'EDN-002',
      endorsementId: 'endorsement-1',
    });

    const result = await service.createEndorsementDebitNote(
      user,
      'placement-1',
      'endorsement-1',
    );

    expect(result.noteNumber).toBe('EDN-002');
    expect(prisma.placementNote.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      },
    });
  });

  it('creates endorsement credit note from a confirmed endorsement closing snapshot', async () => {
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
    });
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementClosing.findFirst.mockResolvedValue(
      confirmedEndorsementClosing,
    );
    prisma.placementNote.count.mockResolvedValue(0);
    prisma.placementNote.create.mockResolvedValue({
      ...note,
      id: 'endorsement-credit-note-1',
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      noteNumber: 'ECN-001',
      endorsementId: 'endorsement-1',
      endorsementClosingId: 'endorsement-closing-1',
      endorsementParticipantId: 'endorsement-participant-1',
      counterpartyId: 'reinsurer-1',
    });

    await service.createEndorsementCreditNote(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
    );

    const createArgs = firstCallArg<Prisma.PlacementNoteCreateArgs>(
      prisma.placementNote.create,
    );
    expect(createArgs.data).toMatchObject({
      placementId: 'placement-1',
      endorsementId: 'endorsement-1',
      endorsementClosingId: 'endorsement-closing-1',
      endorsementParticipantId: 'endorsement-participant-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      noteNumber: 'ECN-001',
      grossAmount: 1500,
      commissionPercent: 10,
      commissionAmount: 150,
      brokeragePercent: 7.5,
      brokerageAmount: 112.5,
      netAmount: 1237.5,
    });
  });

  it('creates endorsement credit note with positive return premium values from signed negative closing impact', async () => {
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
      impactType: PlacementEndorsementImpactType.DECREASE_OR_CANCELLATION,
    });
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementClosing.findFirst.mockResolvedValue({
      ...confirmedEndorsementClosing,
      premiumSnapshot: new Prisma.Decimal('-501.37'),
      commissionAmount: new Prisma.Decimal('-50.14'),
      brokerageAmount: new Prisma.Decimal('-25.07'),
      netPremium: new Prisma.Decimal('-426.16'),
    });
    prisma.placementNote.count.mockResolvedValue(0);
    prisma.placementNote.create.mockResolvedValue({
      ...note,
      id: 'endorsement-credit-note-1',
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      noteNumber: 'ECN-001',
      endorsementId: 'endorsement-1',
      endorsementClosingId: 'endorsement-closing-1',
      endorsementParticipantId: 'endorsement-participant-1',
      counterpartyId: 'reinsurer-1',
    });

    await service.createEndorsementCreditNote(
      user,
      'placement-1',
      'endorsement-1',
      'endorsement-closing-1',
    );

    const createArgs = firstCallArg<Prisma.PlacementNoteCreateArgs>(
      prisma.placementNote.create,
    );
    expect(createArgs.data).toMatchObject({
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      grossAmount: 501.37,
      commissionAmount: 50.14,
      brokerageAmount: 25.07,
      netAmount: 426.16,
    });
  });

  it('rejects endorsement credit note for non-confirmed or wrong-tenant closing', async () => {
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
    });
    prisma.placementNote.findFirst.mockResolvedValue(null);
    prisma.placementEndorsementClosing.findFirst.mockResolvedValue(null);

    await expect(
      service.createEndorsementCreditNote(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-closing-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate active endorsement credit note', async () => {
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
    });
    prisma.placementNote.findFirst.mockResolvedValue({ id: 'active-note' });

    await expect(
      service.createEndorsementCreditNote(
        user,
        'placement-1',
        'endorsement-1',
        'endorsement-closing-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('lists and gets endorsement notes scoped to tenant placement and endorsement', async () => {
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
    });
    prisma.placementNote.findMany.mockResolvedValue([
      {
        ...note,
        type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
        endorsementId: 'endorsement-1',
      },
    ]);
    prisma.placementNote.findFirst.mockResolvedValue({
      ...note,
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      endorsementId: 'endorsement-1',
    });

    const list = await service.findAllEndorsementNotes(
      'tenant-1',
      'placement-1',
      'endorsement-1',
    );
    const detail = await service.findEndorsementNote(
      'tenant-1',
      'placement-1',
      'endorsement-1',
      'note-1',
    );

    expect(prisma.placementNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          placementId: 'placement-1',
          endorsementId: 'endorsement-1',
        },
      }),
    );
    expect(list).toHaveLength(1);
    expect(detail.endorsementId).toBe('endorsement-1');
  });

  it('issues a draft note', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue(note);
    prisma.placementNote.update.mockResolvedValue({
      ...note,
      status: PlacementNoteStatus.ISSUED,
      issuedAt: new Date('2026-06-04T13:00:00.000Z'),
    });

    await service.issue(user, 'placement-1', 'note-1', {
      status: PlacementNoteStatus.ISSUED,
    });

    const updateArgs = firstCallArg<Prisma.PlacementNoteUpdateArgs>(
      prisma.placementNote.update,
    );
    expect(updateArgs.where).toEqual({ id: 'note-1' });
    expect(updateArgs.data).toMatchObject({
      status: PlacementNoteStatus.ISSUED,
    });
  });

  it('issues a draft endorsement note', async () => {
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
    });
    prisma.placementNote.findFirst.mockResolvedValue({
      ...note,
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      endorsementId: 'endorsement-1',
    });
    prisma.placementNote.update.mockResolvedValue({
      ...note,
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      endorsementId: 'endorsement-1',
      status: PlacementNoteStatus.ISSUED,
      issuedAt: new Date('2026-06-04T13:00:00.000Z'),
    });

    await service.issueEndorsementNote(
      user,
      'placement-1',
      'endorsement-1',
      'note-1',
      { status: PlacementNoteStatus.ISSUED },
    );

    const updateArgs = firstCallArg<Prisma.PlacementNoteUpdateArgs>(
      prisma.placementNote.update,
    );
    expect(updateArgs.where).toEqual({ id: 'note-1' });
    expect(updateArgs.data).toMatchObject({
      status: PlacementNoteStatus.ISSUED,
    });
  });

  it('rejects unsupported status transitions and keeps VOID terminal', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue({
      ...note,
      status: PlacementNoteStatus.VOID,
    });

    await expect(
      service.issue(user, 'placement-1', 'note-1', {
        status: PlacementNoteStatus.ISSUED,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('voids draft or issued notes with a reason', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue({
      ...note,
      status: PlacementNoteStatus.ISSUED,
    });
    prisma.placementNote.update.mockResolvedValue({
      ...note,
      status: PlacementNoteStatus.VOID,
      voidReason: 'Issued in error',
    });

    await service.void(user, 'placement-1', 'note-1', {
      voidReason: 'Issued in error',
    });

    const updateArgs = firstCallArg<Prisma.PlacementNoteUpdateArgs>(
      prisma.placementNote.update,
    );
    expect(updateArgs.data).toMatchObject({
      status: PlacementNoteStatus.VOID,
      voidReason: 'Issued in error',
    });
  });

  it('voids draft or issued endorsement notes with a reason', async () => {
    prisma.placementEndorsement.findFirst.mockResolvedValue({
      id: 'endorsement-1',
    });
    prisma.placementNote.findFirst.mockResolvedValue({
      ...note,
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      endorsementId: 'endorsement-1',
      status: PlacementNoteStatus.ISSUED,
    });
    prisma.placementNote.update.mockResolvedValue({
      ...note,
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      endorsementId: 'endorsement-1',
      status: PlacementNoteStatus.VOID,
      voidReason: 'Issued in error',
    });

    await service.voidEndorsementNote(
      user,
      'placement-1',
      'endorsement-1',
      'note-1',
      { voidReason: 'Issued in error' },
    );

    const updateArgs = firstCallArg<Prisma.PlacementNoteUpdateArgs>(
      prisma.placementNote.update,
    );
    expect(updateArgs.data).toMatchObject({
      status: PlacementNoteStatus.VOID,
      voidReason: 'Issued in error',
    });
  });

  it('rejects voiding a VOID note', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementNote.findFirst.mockResolvedValue({
      ...note,
      status: PlacementNoteStatus.VOID,
    });

    await expect(
      service.void(user, 'placement-1', 'note-1', {
        voidReason: 'Try again',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
