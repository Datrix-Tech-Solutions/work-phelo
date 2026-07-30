import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  CounterpartyType,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  PlacementPaymentDirection,
  PlacementPaymentStatus,
  PlacementPaymentType,
  Prisma,
} from '../../prisma/generated/client';
import { ReinsuranceFinancialEventPublisher } from '../accounting-integration/reinsurance-financial-event-publisher.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlacementFinancialPositionService } from './placement-financial-position.service';
import { PlacementPaymentsService } from './placement-payments.service';

describe('PlacementPaymentsService', () => {
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
    permissions: [] as string[],
  };

  const placement = {
    id: 'placement-1',
    tenantId: 'tenant-1',
    cedantId: 'cedant-1',
    currency: 'USD',
    reference: 'FAC-001',
    policyNumber: 'POL-001',
    title: 'Xpress Group',
  };

  const payment = {
    id: 'payment-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    closingId: null,
    endorsementClosingId: null,
    participantId: null,
    counterpartyId: 'cedant-1',
    type: PlacementPaymentType.PREMIUM_RECEIVED,
    direction: PlacementPaymentDirection.INBOUND,
    amount: new Prisma.Decimal('1000.00'),
    currency: 'USD',
    paymentDate: new Date('2026-06-04T12:00:00.000Z'),
    reference: 'BANK-001',
    settlementReference: null,
    bankReference: null,
    bankConfirmedAt: null,
    bankConfirmedByUserId: null,
    agreedExchangeRate: null,
    bankChargeAmount: new Prisma.Decimal('0.00'),
    withholdingTaxAmount: new Prisma.Decimal('0.00'),
    notes: null,
    status: PlacementPaymentStatus.RECORDED,
    reversalOfPaymentId: null,
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
    endorsementClosing: null,
    allocations: [],
  };

  const issuedCreditNote = (overrides: Record<string, unknown> = {}) => ({
    id: 'credit-note-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    counterpartyId: 'reinsurer-1',
    type: PlacementNoteType.CREDIT_NOTE,
    direction: PlacementNoteDirection.BROKER_TO_REINSURER,
    status: PlacementNoteStatus.ISSUED,
    currency: 'USD',
    netAmount: new Prisma.Decimal('500.00'),
    ...overrides,
  });

  let prisma: {
    placement: { findFirst: PrismaMethod };
    counterparty: { findFirst: PrismaMethod };
    placementNote: { findMany: PrismaMethod };
    placementClosing: { findFirst: PrismaMethod; findMany: PrismaMethod };
    placementEndorsementClosing: { findFirst: PrismaMethod };
    placementPayment: {
      findMany: PrismaMethod;
      findFirst: PrismaMethod;
      create: PrismaMethod;
      update: PrismaMethod;
    };
    $transaction: jest.Mock;
  };
  let financialPositionService: {
    getFinancialPosition: jest.Mock;
  };
  let financialEvents: {
    preparePremiumPaymentReceived: jest.Mock<unknown, [unknown, unknown]>;
    preparePaymentReversed: jest.Mock<unknown, [unknown, unknown]>;
    prepareReinsurerDisbursementRecorded: jest.Mock<
      unknown,
      [unknown, unknown]
    >;
    enqueuePreparedEvent: jest.Mock;
  };
  let service: PlacementPaymentsService;

  beforeEach(() => {
    prisma = {
      placement: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      counterparty: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
      placementNote: { findMany: jest.fn<Promise<unknown>, [unknown]>() },
      placementClosing: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementEndorsementClosing: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      },
      placementPayment: {
        findMany: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    financialPositionService = {
      getFinancialPosition: jest.fn().mockResolvedValue({
        currency: 'USD',
        isMultiCurrency: false,
        cedant: {
          currentObligation: 1000,
          outstanding: 1000,
        },
        reinsurers: [
          {
            counterpartyId: 'reinsurer-1',
            outstanding: 1000,
          },
        ],
      }),
    };
    financialEvents = {
      preparePremiumPaymentReceived: jest
        .fn<unknown, [unknown, unknown]>()
        .mockReturnValue(null),
      preparePaymentReversed: jest
        .fn<unknown, [unknown, unknown]>()
        .mockReturnValue(null),
      prepareReinsurerDisbursementRecorded: jest
        .fn<unknown, [unknown, unknown]>()
        .mockReturnValue(null),
      enqueuePreparedEvent: jest.fn(),
    };
    prisma.placementClosing.findMany.mockResolvedValue([
      {
        id: 'closing-1',
        participantId: 'participant-1',
        netPremium: '1000.00',
        currency: 'USD',
      },
    ]);
    prisma.placementPayment.findMany.mockResolvedValue([]);
    service = new PlacementPaymentsService(
      prisma as unknown as PrismaService,
      financialPositionService as unknown as PlacementFinancialPositionService,
      financialEvents as unknown as ReinsuranceFinancialEventPublisher,
    );
  });

  it('lists payments for an active tenant placement', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findMany.mockResolvedValue([payment]);

    const result = await service.findAll('tenant-1', 'placement-1');

    expect(prisma.placementPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', placementId: 'placement-1' },
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('throws NotFoundException when listing payments for another tenant placement', async () => {
    prisma.placement.findFirst.mockResolvedValue(null);

    await expect(service.findAll('tenant-1', 'unknown')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates a cedant premium received payment', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    prisma.placementClosing.findFirst.mockResolvedValue({ id: 'closing-1' });
    prisma.placementPayment.create.mockResolvedValue(payment);

    const result = await service.create(user, 'placement-1', {
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      direction: PlacementPaymentDirection.INBOUND,
      counterpartyId: 'cedant-1',
      amount: 1000,
      currency: 'usd',
      paymentDate: '2026-06-04T12:00:00.000Z',
    });

    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    expect(createArgs.data).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        placementId: 'placement-1',
        counterpartyId: 'cedant-1',
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        amount: 1000,
        currency: 'USD',
        status: PlacementPaymentStatus.RECORDED,
      }),
    );
    const paymentEventArg = financialEvents.preparePremiumPaymentReceived.mock
      .calls[0]?.[1] as
      | { id?: string; placement?: { id?: string; reference?: string } }
      | undefined;
    if (!paymentEventArg) {
      throw new Error('Expected premium payment event preparation');
    }
    expect(paymentEventArg.id).toBe('payment-1');
    expect(paymentEventArg.placement).toMatchObject({
      id: 'placement-1',
      reference: 'FAC-001',
    });
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
    expect(result.id).toBe('payment-1');
  });

  it('captures a premium received accounting event atomically when Accounting is enabled', async () => {
    const preparedEvent = {
      tenantId: 'tenant-1',
      sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: 'payment-1',
      sourceDocumentId: 'payment-1',
      idempotencyKey: 'reinsurance:payment:payment-1:recorded:v1',
      occurredAt: '2026-06-04T12:00:00.000Z',
      currency: 'USD',
      payload: { amounts: { paymentAmount: 1000 } },
    };
    financialEvents.preparePremiumPaymentReceived.mockReturnValue(
      preparedEvent,
    );
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    prisma.placementPayment.create.mockResolvedValue(payment);

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      direction: PlacementPaymentDirection.INBOUND,
      counterpartyId: 'cedant-1',
      amount: 1000,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
    });

    expect(financialEvents.enqueuePreparedEvent).toHaveBeenCalledWith(
      prisma,
      preparedEvent,
    );
  });

  it('rolls back premium payment creation when required accounting capture fails', async () => {
    const mutablePayments: unknown[] = [];
    const preparedEvent = {
      tenantId: 'tenant-1',
      sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: 'payment-1',
      sourceDocumentId: 'payment-1',
      idempotencyKey: 'reinsurance:payment:payment-1:recorded:v1',
      occurredAt: '2026-06-04T12:00:00.000Z',
      currency: 'USD',
      payload: { amounts: { paymentAmount: 1000 } },
    };
    financialEvents.preparePremiumPaymentReceived.mockReturnValue(
      preparedEvent,
    );
    financialEvents.enqueuePreparedEvent.mockRejectedValue(
      new Error('Outbox insert failed'),
    );
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    prisma.placementPayment.create.mockImplementation(() => {
      mutablePayments.push(payment);
      return Promise.resolve(payment);
    });
    prisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        const before = [...mutablePayments];
        try {
          return await callback(prisma);
        } catch (error) {
          mutablePayments.splice(0, mutablePayments.length, ...before);
          throw error;
        }
      },
    );

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        counterpartyId: 'cedant-1',
        amount: 1000,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
      }),
    ).rejects.toThrow('Outbox insert failed');

    expect(mutablePayments).toHaveLength(0);
  });

  it('does not enqueue a premium received event when Accounting is disabled', async () => {
    const disabledUser = {
      ...user,
      moduleConfig: { operations: true, accounting: false },
    };
    financialEvents.preparePremiumPaymentReceived.mockReturnValue(null);
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    prisma.placementPayment.create.mockResolvedValue(payment);

    await service.create(disabledUser, 'placement-1', {
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      direction: PlacementPaymentDirection.INBOUND,
      counterpartyId: 'cedant-1',
      amount: 1000,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
    });

    expect(financialEvents.preparePremiumPaymentReceived).toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('rejects payment before any confirmed closing exists', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    financialPositionService.getFinancialPosition.mockResolvedValue({
      currency: 'USD',
      isMultiCurrency: false,
      cedant: {
        currentObligation: 0,
        outstanding: 0,
      },
    });

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        counterpartyId: 'cedant-1',
        amount: 1000,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a payment currency mismatch', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        counterpartyId: 'cedant-1',
        amount: 1000,
        currency: 'GHS',
        paymentDate: '2026-06-04T12:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects premium received from a non-cedant counterparty', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'other-1',
      type: CounterpartyType.CEDANT,
    });
    prisma.placementClosing.findFirst.mockResolvedValue({ id: 'closing-1' });

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        counterpartyId: 'other-1',
        amount: 1000,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a bank-confirmed reinsurer disbursement with one credit-note allocation', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementNote.findMany.mockResolvedValue([issuedCreditNote()]);
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-2',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.BANK_CONFIRMED,
    });

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      counterpartyId: 'reinsurer-1',
      amount: 500,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
      bankConfirmedAt: '2026-06-04T12:05:00.000Z',
      bankReference: 'BANK-CONF-001',
      settlementReference: 'SETTLE-001',
      bankChargeAmount: 12.5,
      withholdingTaxAmount: 25,
      allocations: [{ noteId: 'credit-note-1', allocatedAmount: 500 }],
    });

    const noteLookup = firstCallArg<Prisma.PlacementNoteFindManyArgs>(
      prisma.placementNote.findMany,
    );
    expect(noteLookup.where).toMatchObject({
      id: { in: ['credit-note-1'] },
      tenantId: 'tenant-1',
      placementId: 'placement-1',
      counterpartyId: 'reinsurer-1',
      status: PlacementNoteStatus.ISSUED,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
    });

    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    expect(createArgs.data).toMatchObject({
      counterpartyId: 'reinsurer-1',
      status: PlacementPaymentStatus.BANK_CONFIRMED,
      bankReference: 'BANK-CONF-001',
      settlementReference: 'SETTLE-001',
      bankConfirmedAt: new Date('2026-06-04T12:05:00.000Z'),
      bankConfirmedByUserId: 'user-1',
      bankChargeAmount: 12.5,
      withholdingTaxAmount: 25,
      allocations: {
        create: [
          expect.objectContaining({
            noteId: 'credit-note-1',
            allocatedAmount: new Prisma.Decimal('500'),
            allocatedCurrency: 'USD',
            obligationAmount: new Prisma.Decimal('500'),
            obligationCurrency: 'USD',
          }),
        ],
      },
    });
    expect(
      financialEvents.preparePremiumPaymentReceived,
    ).not.toHaveBeenCalled();
    expect(
      financialEvents.prepareReinsurerDisbursementRecorded,
    ).toHaveBeenCalledWith(
      user,
      expect.objectContaining({
        id: 'payment-2',
        status: PlacementPaymentStatus.BANK_CONFIRMED,
        placement,
      }),
    );
  });

  it('captures a bank-confirmed reinsurer disbursement accounting event atomically when Accounting is enabled', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementNote.findMany.mockResolvedValue([issuedCreditNote()]);
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-disbursement-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.BANK_CONFIRMED,
    });
    financialEvents.prepareReinsurerDisbursementRecorded.mockReturnValue({
      tenantId: 'tenant-1',
      sourceEventType: 'REINSURER_DISBURSEMENT_RECORDED',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: 'payment-disbursement-1',
      sourceDocumentId: 'payment-disbursement-1',
      idempotencyKey:
        'reinsurance:reinsurer-disbursement:payment-disbursement-1:recorded:v1',
      occurredAt: '2026-06-04T12:05:00.000Z',
      currency: 'USD',
      payload: { amounts: { paymentAmount: 500 } },
    });

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      counterpartyId: 'reinsurer-1',
      amount: 500,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
      bankConfirmedAt: '2026-06-04T12:05:00.000Z',
      bankReference: 'BANK-CONF-001',
      allocations: [{ noteId: 'credit-note-1', allocatedAmount: 500 }],
    });

    expect(financialEvents.enqueuePreparedEvent).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        sourceEventType: 'REINSURER_DISBURSEMENT_RECORDED',
        idempotencyKey:
          'reinsurance:reinsurer-disbursement:payment-disbursement-1:recorded:v1',
      }),
    );
  });

  it('rolls back bank-confirmed reinsurer disbursement creation when required accounting capture fails', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementNote.findMany.mockResolvedValue([issuedCreditNote()]);
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-disbursement-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.BANK_CONFIRMED,
    });
    financialEvents.prepareReinsurerDisbursementRecorded.mockReturnValue({
      tenantId: 'tenant-1',
      sourceEventType: 'REINSURER_DISBURSEMENT_RECORDED',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: 'payment-disbursement-1',
      sourceDocumentId: 'payment-disbursement-1',
      idempotencyKey:
        'reinsurance:reinsurer-disbursement:payment-disbursement-1:recorded:v1',
      occurredAt: '2026-06-04T12:05:00.000Z',
      currency: 'USD',
      payload: { amounts: { paymentAmount: 500 } },
    });
    financialEvents.enqueuePreparedEvent.mockRejectedValue(
      new Error('outbox unavailable'),
    );

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        direction: PlacementPaymentDirection.OUTBOUND,
        counterpartyId: 'reinsurer-1',
        amount: 500,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
        bankConfirmedAt: '2026-06-04T12:05:00.000Z',
        bankReference: 'BANK-CONF-001',
        allocations: [{ noteId: 'credit-note-1', allocatedAmount: 500 }],
      }),
    ).rejects.toThrow('outbox unavailable');
  });

  it('does not enqueue a reinsurer disbursement event when Accounting is disabled', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementNote.findMany.mockResolvedValue([issuedCreditNote()]);
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-disbursement-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.BANK_CONFIRMED,
    });
    financialEvents.prepareReinsurerDisbursementRecorded.mockReturnValue(null);

    await service.create(
      { ...user, moduleConfig: { operations: true, accounting: false } },
      'placement-1',
      {
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        direction: PlacementPaymentDirection.OUTBOUND,
        counterpartyId: 'reinsurer-1',
        amount: 500,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
        bankConfirmedAt: '2026-06-04T12:05:00.000Z',
        bankReference: 'BANK-CONF-001',
        allocations: [{ noteId: 'credit-note-1', allocatedAmount: 500 }],
      },
    );

    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('allows one reinsurer payment to settle multiple issued credit notes', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementNote.findMany.mockResolvedValue([
      issuedCreditNote(),
      issuedCreditNote({
        id: 'endorsement-credit-note-1',
        type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
        netAmount: new Prisma.Decimal('250.00'),
      }),
    ]);
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-multi-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      status: PlacementPaymentStatus.BANK_CONFIRMED,
    });

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      counterpartyId: 'reinsurer-1',
      amount: 750,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
      bankConfirmedAt: '2026-06-04T12:05:00.000Z',
      bankReference: 'BANK-CONF-001',
      allocations: [
        { noteId: 'credit-note-1', allocatedAmount: 500 },
        { noteId: 'endorsement-credit-note-1', allocatedAmount: 250 },
      ],
    });

    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    const create = createArgs.data as { allocations?: { create?: unknown[] } };
    expect(create.allocations?.create).toHaveLength(2);
  });

  it('persists the agreed exchange rate when payment currency differs from credit-note currency', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementNote.findMany.mockResolvedValue([
      issuedCreditNote({
        currency: 'EUR',
        netAmount: new Prisma.Decimal('80'),
      }),
    ]);
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-fx-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      currency: 'USD',
      status: PlacementPaymentStatus.BANK_CONFIRMED,
    });

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      counterpartyId: 'reinsurer-1',
      amount: 100,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
      bankConfirmedAt: '2026-06-04T12:05:00.000Z',
      bankReference: 'BANK-CONF-001',
      agreedExchangeRate: 1.25,
      allocations: [
        {
          noteId: 'credit-note-1',
          allocatedAmount: 100,
          obligationAmount: 80,
        },
      ],
    });

    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    expect(createArgs.data).toMatchObject({
      agreedExchangeRate: 1.25,
      allocations: {
        create: [
          expect.objectContaining({
            allocatedCurrency: 'USD',
            obligationCurrency: 'EUR',
            agreedExchangeRate: new Prisma.Decimal('1.25'),
          }),
        ],
      },
    });
  });

  it('rejects reinsurer disbursement without bank confirmation', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        direction: PlacementPaymentDirection.OUTBOUND,
        counterpartyId: 'reinsurer-1',
        amount: 500,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
        bankReference: 'BANK-CONF-001',
        allocations: [{ noteId: 'credit-note-1', allocatedAmount: 500 }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placementPayment.create).not.toHaveBeenCalled();
  });

  it('rejects unallocated reinsurer disbursements', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        direction: PlacementPaymentDirection.OUTBOUND,
        counterpartyId: 'reinsurer-1',
        amount: 500,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
        bankConfirmedAt: '2026-06-04T12:05:00.000Z',
        bankReference: 'BANK-CONF-001',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects premium received over the current effective outstanding amount', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    financialPositionService.getFinancialPosition.mockResolvedValue({
      currency: 'USD',
      isMultiCurrency: false,
      cedant: {
        currentObligation: 1500,
        outstanding: 300,
      },
    });

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        counterpartyId: 'cedant-1',
        amount: 400,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.placementPayment.create).not.toHaveBeenCalled();
  });

  it('uses the financial position as of the payment date when validating premium outstanding', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    prisma.placementPayment.create.mockResolvedValue(payment);

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      direction: PlacementPaymentDirection.INBOUND,
      counterpartyId: 'cedant-1',
      amount: 1000,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
    });

    expect(financialPositionService.getFinancialPosition).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      new Date('2026-06-04T12:00:00.000Z'),
    );
  });

  it('allows additional premium after an effective endorsement increases the current obligation', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    financialPositionService.getFinancialPosition.mockResolvedValue({
      currency: 'USD',
      isMultiCurrency: false,
      cedant: {
        currentObligation: 1200,
        outstanding: 200,
      },
    });
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-additional-1',
      amount: new Prisma.Decimal('200.00'),
    });

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.PREMIUM_RECEIVED,
      direction: PlacementPaymentDirection.INBOUND,
      counterpartyId: 'cedant-1',
      amount: 200,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
    });

    expect(prisma.placementPayment.create).toHaveBeenCalled();
  });

  it('allows reinsurer overpayment when the full amount is allocated for JV correction', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementNote.findMany.mockResolvedValue([
      issuedCreditNote({ netAmount: new Prisma.Decimal('500.00') }),
    ]);
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-overpay-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      amount: new Prisma.Decimal('575.00'),
      status: PlacementPaymentStatus.BANK_CONFIRMED,
    });

    await service.create(user, 'placement-1', {
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      counterpartyId: 'reinsurer-1',
      amount: 575,
      currency: 'USD',
      paymentDate: '2026-06-04T12:00:00.000Z',
      bankConfirmedAt: '2026-06-04T12:05:00.000Z',
      bankReference: 'BANK-CONF-001',
      allocations: [
        {
          noteId: 'credit-note-1',
          allocatedAmount: 575,
          obligationAmount: 575,
        },
      ],
    });

    expect(prisma.placementPayment.create).toHaveBeenCalled();
  });

  it('rejects wrong-tenant or mismatched credit-note allocations for reinsurer disbursement', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
    });
    prisma.placementNote.findMany.mockResolvedValue([]);

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        direction: PlacementPaymentDirection.OUTBOUND,
        counterpartyId: 'reinsurer-1',
        amount: 500,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
        bankConfirmedAt: '2026-06-04T12:05:00.000Z',
        bankReference: 'BANK-CONF-001',
        allocations: [{ noteId: 'wrong-note-1', allocatedAmount: 500 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects claim settlement payments through the generic payment creation API', async () => {
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.counterparty.findFirst.mockResolvedValue({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
    });
    prisma.placementClosing.findFirst.mockResolvedValue({ id: 'closing-1' });

    await expect(
      service.create(user, 'placement-1', {
        type: PlacementPaymentType.CLAIM_SETTLEMENT,
        direction: PlacementPaymentDirection.OUTBOUND,
        counterpartyId: 'cedant-1',
        amount: 1000,
        currency: 'USD',
        paymentDate: '2026-06-04T12:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.placementPayment.create).not.toHaveBeenCalled();
  });

  it('creates an auditable reversal record and marks the original reversed', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue(payment);
    prisma.placementPayment.update.mockResolvedValue({
      ...payment,
      status: PlacementPaymentStatus.REVERSED,
    });
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-reversal-1',
      amount: new Prisma.Decimal('-1000.00'),
      reversalOfPaymentId: 'payment-1',
    });

    const result = await service.reverse(user, 'placement-1', 'payment-1');

    expect(prisma.placementPayment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: PlacementPaymentStatus.REVERSED },
    });
    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    expect(createArgs.data).toMatchObject({
      amount: new Prisma.Decimal('-1000.00'),
      reversalOfPaymentId: 'payment-1',
      status: PlacementPaymentStatus.RECORDED,
    });
    expect(result.reversalOfPaymentId).toBe('payment-1');
  });

  it('captures a payment reversal accounting event atomically', async () => {
    const preparedEvent = {
      tenantId: 'tenant-1',
      sourceEventType: 'PAYMENT_REVERSED',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: 'payment-reversal-1',
      sourceDocumentId: 'payment-reversal-1',
      idempotencyKey: 'reinsurance:payment:payment-reversal-1:reversal:v1',
      occurredAt: '2026-06-04T13:00:00.000Z',
      currency: 'USD',
      payload: { amounts: { paymentAmount: 1000 } },
    };
    financialEvents.preparePaymentReversed.mockReturnValue(preparedEvent);
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementPayment.findFirst.mockResolvedValue(payment);
    prisma.placementPayment.update.mockResolvedValue({
      ...payment,
      status: PlacementPaymentStatus.REVERSED,
    });
    prisma.placementPayment.create.mockResolvedValue({
      ...payment,
      id: 'payment-reversal-1',
      amount: new Prisma.Decimal('-1000.00'),
      reversalOfPaymentId: 'payment-1',
    });

    await service.reverse(user, 'placement-1', 'payment-1');

    const reversalEventArg = financialEvents.preparePaymentReversed.mock
      .calls[0]?.[1] as
      | {
          id?: string;
          reversalOfPayment?: { id?: string; status?: PlacementPaymentStatus };
          placement?: { id?: string; reference?: string };
        }
      | undefined;
    if (!reversalEventArg) {
      throw new Error('Expected reversal event preparation');
    }
    expect(reversalEventArg.id).toBe('payment-reversal-1');
    expect(reversalEventArg.reversalOfPayment).toMatchObject({
      id: 'payment-1',
      status: PlacementPaymentStatus.REVERSED,
    });
    expect(reversalEventArg.placement).toMatchObject({
      id: 'placement-1',
      reference: 'FAC-001',
    });
    expect(financialEvents.enqueuePreparedEvent).toHaveBeenCalledWith(
      prisma,
      preparedEvent,
    );
  });

  it('rolls back payment reversal when required accounting capture fails', async () => {
    const mutableOriginal = { ...payment };
    const mutableReversals: unknown[] = [];
    const preparedEvent = {
      tenantId: 'tenant-1',
      sourceEventType: 'PAYMENT_REVERSED',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: 'payment-reversal-1',
      sourceDocumentId: 'payment-reversal-1',
      idempotencyKey: 'reinsurance:payment:payment-reversal-1:reversal:v1',
      occurredAt: '2026-06-04T13:00:00.000Z',
      currency: 'USD',
      payload: { amounts: { paymentAmount: 1000 } },
    };
    financialEvents.preparePaymentReversed.mockReturnValue(preparedEvent);
    financialEvents.enqueuePreparedEvent.mockRejectedValue(
      new Error('Outbox insert failed'),
    );
    prisma.placement.findFirst.mockResolvedValue(placement);
    prisma.placementPayment.findFirst.mockResolvedValue(mutableOriginal);
    prisma.placementPayment.update.mockImplementation((args: unknown) => {
      const { data } = args as Prisma.PlacementPaymentUpdateArgs;
      Object.assign(mutableOriginal, data);
      return Promise.resolve(mutableOriginal);
    });
    prisma.placementPayment.create.mockImplementation(() => {
      const reversal = {
        ...payment,
        id: 'payment-reversal-1',
        amount: new Prisma.Decimal('-1000.00'),
        reversalOfPaymentId: 'payment-1',
      };
      mutableReversals.push(reversal);
      return Promise.resolve(reversal);
    });
    prisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        const beforeOriginal = { ...mutableOriginal };
        const beforeReversals = [...mutableReversals];
        try {
          return await callback(prisma);
        } catch (error) {
          Object.assign(mutableOriginal, beforeOriginal);
          mutableReversals.splice(
            0,
            mutableReversals.length,
            ...beforeReversals,
          );
          throw error;
        }
      },
    );

    await expect(
      service.reverse(user, 'placement-1', 'payment-1'),
    ).rejects.toThrow('Outbox insert failed');

    expect(mutableOriginal.status).toBe(PlacementPaymentStatus.RECORDED);
    expect(mutableReversals).toHaveLength(0);
  });

  it('preserves endorsement closing source when reversing an endorsement disbursement', async () => {
    const endorsementPayment = {
      ...payment,
      id: 'payment-endorsement-1',
      counterpartyId: 'reinsurer-c',
      type: PlacementPaymentType.REINSURER_DISBURSEMENT,
      direction: PlacementPaymentDirection.OUTBOUND,
      closingId: null,
      endorsementClosingId: 'endorsement-closing-c',
      participantId: null,
    };
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue(endorsementPayment);
    prisma.placementPayment.update.mockResolvedValue({
      ...endorsementPayment,
      status: PlacementPaymentStatus.REVERSED,
    });
    prisma.placementPayment.create.mockResolvedValue({
      ...endorsementPayment,
      id: 'payment-endorsement-reversal-1',
      amount: new Prisma.Decimal('-1000.00'),
      reversalOfPaymentId: 'payment-endorsement-1',
    });

    await service.reverse(user, 'placement-1', 'payment-endorsement-1');

    const createArgs = firstCallArg<Prisma.PlacementPaymentCreateArgs>(
      prisma.placementPayment.create,
    );
    expect(createArgs.data).toMatchObject({
      closingId: null,
      endorsementClosingId: 'endorsement-closing-c',
      participantId: null,
      reversalOfPaymentId: 'payment-endorsement-1',
    });
  });

  it('rejects reversing an already reversed payment', async () => {
    prisma.placement.findFirst.mockResolvedValue({ id: 'placement-1' });
    prisma.placementPayment.findFirst.mockResolvedValue({
      ...payment,
      status: PlacementPaymentStatus.REVERSED,
    });

    await expect(
      service.reverse(user, 'placement-1', 'payment-1'),
    ).rejects.toThrow(ConflictException);
  });
});
