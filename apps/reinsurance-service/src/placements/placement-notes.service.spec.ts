import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  CounterpartyType,
  PlacementClosingStatus,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
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

  let prisma: {
    placement: { findFirst: PrismaMethod };
    placementClosing: {
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
    $transaction: jest.Mock;
  };
  let service: PlacementNotesService;

  beforeEach(() => {
    prisma = {
      placement: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementClosing: {
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
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    service = new PlacementNotesService(prisma as unknown as PrismaService);
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
