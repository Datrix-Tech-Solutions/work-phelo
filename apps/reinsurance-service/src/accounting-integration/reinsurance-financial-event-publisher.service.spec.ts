import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyOrigin,
  CounterpartyType,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  PlacementPaymentDirection,
  PlacementPaymentStatus,
  PlacementPaymentType,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReinsuranceAccountingOutboxService } from './reinsurance-accounting-outbox.service';
import { ReinsuranceFinancialEventPublisher } from './reinsurance-financial-event-publisher.service';

describe('ReinsuranceFinancialEventPublisher', () => {
  const user = {
    id: 'user-1',
    email: 'broker@example.com',
    role: 'EMPLOYEE',
    tenantId: 'tenant-1',
    tenantSlug: 'broker',
    tenantName: 'Broker',
    firstName: 'Ama',
    moduleConfig: { accounting: true },
    featureConfig: { operations: { reinsurance: true } },
    permissions: [],
  } as RequestUser;

  const placement = {
    id: 'placement-1',
    reference: 'FAC-2026-001',
    policyNumber: 'POL-2026-001',
    title: 'Factory Fire Risk',
    cedantId: 'cedant-1',
  };

  const counterparty = {
    id: 'cedant-1',
    tenantId: 'tenant-1',
    type: CounterpartyType.CEDANT,
    origin: CounterpartyOrigin.LOCAL,
    name: 'Acme Insurance',
    normalizedName: 'acme insurance',
    registrationNumber: 'REG-123',
    country: 'GH',
    taxId: null,
    licenseNumber: null,
    email: null,
    phone: null,
    website: null,
    notes: null,
    brokerageFee: null,
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    archivedByUserId: null,
    archivedAt: null,
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    updatedAt: new Date('2026-06-01T10:00:00.000Z'),
  };

  const note = {
    id: 'note-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    counterpartyId: 'cedant-1',
    type: PlacementNoteType.DEBIT_NOTE,
    direction: PlacementNoteDirection.CEDANT_TO_BROKER,
    noteNumber: 'DN-001',
    status: PlacementNoteStatus.DRAFT,
    currency: 'GHS',
    grossAmount: new Prisma.Decimal('10000.00'),
    commissionPercent: new Prisma.Decimal('10.0000'),
    commissionAmount: new Prisma.Decimal('1000.00'),
    brokeragePercent: new Prisma.Decimal('5.00'),
    brokerageAmount: new Prisma.Decimal('500.00'),
    nicLevyPercent: new Prisma.Decimal('1.0000'),
    nicLevyAmount: new Prisma.Decimal('100.00'),
    withholdingTaxPercent: new Prisma.Decimal('0.5000'),
    withholdingTaxAmount: new Prisma.Decimal('50.00'),
    netAmount: new Prisma.Decimal('8550.00'),
    appliedCharges: [
      {
        code: 'NIC_LEVY',
        name: 'NIC Levy',
        amount: 100,
      },
    ] as Prisma.JsonArray,
    noteDate: new Date('2026-06-04T12:00:00.000Z'),
    issuedAt: null,
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
    currency: 'GHS',
    paymentDate: new Date('2026-06-05T10:30:00.000Z'),
    reference: 'BANK-001',
    notes: 'Bank transfer',
    status: PlacementPaymentStatus.RECORDED,
    reversalOfPaymentId: null,
    counterparty: {
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
      name: 'Acme Insurance',
      registrationNumber: 'ACME-001',
    },
    placement: {
      id: 'placement-1',
      reference: 'FAC-2026-001',
      policyNumber: 'POL-001',
      title: 'Xpress Group',
      cedantId: 'cedant-1',
    },
  };

  const makeService = (overrides?: { accountingEnabled?: boolean }) => {
    const prisma = {
      placement: {
        findFirst: jest.fn().mockResolvedValue(placement),
      },
      placementEndorsement: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'endorsement-1',
          endorsementNumber: 'END-001',
          type: 'CAPACITY_CHANGE',
          impactType: 'CAPACITY_INCREASE',
          effectiveDate: new Date('2026-06-10T00:00:00.000Z'),
          status: 'CLOSING',
        }),
      },
      counterparty: {
        findFirst: jest.fn().mockResolvedValue(counterparty),
      },
    };
    const outbox = {
      enqueueAccountingEvent: jest.fn(),
    };
    const actor = {
      ...user,
      moduleConfig: { accounting: overrides?.accountingEnabled ?? true },
    } as RequestUser;
    const service = new ReinsuranceFinancialEventPublisher(
      prisma as unknown as PrismaService,
      outbox as unknown as ReinsuranceAccountingOutboxService,
    );

    return { actor, outbox, prisma, service };
  };

  it('prepares a WFIS-compliant DEBIT_NOTE_ISSUED event from the note snapshot', async () => {
    const { actor, service } = makeService();

    const event = await service.prepareDebitNoteIssued(
      actor,
      note,
      new Date('2026-06-04T13:00:00.000Z'),
    );

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'DEBIT_NOTE_ISSUED',
      sourceRecordType: 'PlacementNote',
      sourceRecordId: 'note-1',
      sourceDocumentId: 'note-1',
      idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
      occurredAt: '2026-06-04T13:00:00.000Z',
      currency: 'GHS',
    });
    if (!event) throw new Error('Expected DEBIT_NOTE_ISSUED event');

    const payload = event.payload as {
      transactionDate: string;
      currency: string;
      references: Record<string, unknown>;
      counterparty: Record<string, unknown>;
      amounts: Record<string, unknown>;
      documents: Record<string, unknown>;
    };
    expect(payload.transactionDate).toBe('2026-06-04T13:00:00.000Z');
    expect(payload.currency).toBe('GHS');
    expect(payload.references).toMatchObject({
      placementId: 'placement-1',
      placementReference: 'FAC-2026-001',
      policyNumber: 'POL-2026-001',
      noteNumber: 'DN-001',
    });
    expect(payload.counterparty).toEqual({
      id: 'cedant-1',
      type: 'CEDANT',
      name: 'Acme Insurance',
      registrationNumber: 'REG-123',
      subledgerExternalRef: 'cedant-1',
    });
    expect(payload.amounts).toMatchObject({
      grossPremium: 10000,
      commissionAmount: 1000,
      brokerageAmount: 500,
      nicLevyAmount: 100,
      withholdingTaxAmount: 50,
      netPremium: 8550,
      netAmount: 8550,
    });
    expect(payload.documents).toEqual({
      placementNoteId: 'note-1',
      placementNoteNumber: 'DN-001',
      sourceDocumentId: 'note-1',
    });
  });

  it('skips publishing when Accounting is disabled for the tenant', async () => {
    const { actor, service } = makeService({
      accountingEnabled: false,
    });

    const event = await service.prepareDebitNoteIssued(
      actor,
      note,
      new Date('2026-06-04T13:00:00.000Z'),
    );

    expect(event).toBeNull();
  });

  it('prepares a WFIS-compliant CREDIT_NOTE_ISSUED event from the note snapshot', async () => {
    const { actor, service } = makeService();
    const creditNote = {
      ...note,
      id: 'credit-note-1',
      closingId: 'closing-1',
      participantId: 'participant-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementNoteType.CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      noteNumber: 'CN-001',
      grossAmount: new Prisma.Decimal('4500.00'),
      commissionAmount: new Prisma.Decimal('450.00'),
      brokerageAmount: new Prisma.Decimal('337.50'),
      netAmount: new Prisma.Decimal('3712.50'),
      counterparty: {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Reliable Re',
        registrationNumber: 'RE-001',
      },
      closing: {
        id: 'closing-1',
        closingNumber: 'CLO-001',
      },
    };

    const event = await service.prepareCreditNoteIssued(
      actor,
      creditNote,
      new Date('2026-06-04T13:00:00.000Z'),
    );

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'CREDIT_NOTE_ISSUED',
      sourceRecordType: 'PlacementNote',
      sourceRecordId: 'credit-note-1',
      sourceDocumentId: 'credit-note-1',
      idempotencyKey: 'reinsurance:credit-note:credit-note-1:issued:v1',
      occurredAt: '2026-06-04T13:00:00.000Z',
      currency: 'GHS',
    });
    if (!event) throw new Error('Expected CREDIT_NOTE_ISSUED event');

    const payload = event.payload as {
      references: Record<string, unknown>;
      counterparty: Record<string, unknown>;
      amounts: Record<string, unknown>;
      note: Record<string, unknown>;
    };
    expect(payload.references).toMatchObject({
      placementId: 'placement-1',
      placementReference: 'FAC-2026-001',
      closingId: 'closing-1',
      closingNumber: 'CLO-001',
      participantId: 'participant-1',
      noteNumber: 'CN-001',
    });
    expect(payload.counterparty).toEqual({
      id: 'reinsurer-1',
      type: 'REINSURER',
      name: 'Reliable Re',
      registrationNumber: 'RE-001',
      subledgerExternalRef: 'reinsurer-1',
    });
    expect(payload.amounts).toMatchObject({
      grossPremium: 4500,
      commissionAmount: 450,
      brokerageAmount: 337.5,
      charges: 150,
      netAmount: 3712.5,
      creditMagnitude: 3712.5,
      signedReceivableImpact: 0,
      signedPayableImpact: 3712.5,
    });
    expect(payload.note).toMatchObject({
      type: PlacementNoteType.CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      status: PlacementNoteStatus.ISSUED,
      amountRepresentation: 'POSITIVE_MAGNITUDE_WITH_SIGNED_IMPACTS',
    });
  });

  it('does not prepare CREDIT_NOTE_ISSUED for the wrong note type', async () => {
    const { actor, service } = makeService();

    await expect(
      service.prepareCreditNoteIssued(
        actor,
        note,
        new Date('2026-06-04T13:00:00.000Z'),
      ),
    ).rejects.toThrow(
      'Note note-1 is not a valid issued placement credit note',
    );
  });

  it('prepares ENDORSEMENT_DEBIT_NOTE_ISSUED from an issued endorsement debit note snapshot', async () => {
    const { actor, service } = makeService();
    const endorsementDebitNote = {
      ...note,
      id: 'endorsement-debit-note-1',
      endorsementId: 'endorsement-1',
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      direction: PlacementNoteDirection.CEDANT_TO_BROKER,
      noteNumber: 'EDN-001',
      grossAmount: new Prisma.Decimal('2500.00'),
      commissionAmount: new Prisma.Decimal('250.00'),
      brokerageAmount: new Prisma.Decimal('0.00'),
      netAmount: new Prisma.Decimal('2250.00'),
      endorsement: {
        id: 'endorsement-1',
        endorsementNumber: 'END-001',
        type: 'CAPACITY_CHANGE',
        impactType: 'CAPACITY_INCREASE',
        effectiveDate: new Date('2026-06-10T00:00:00.000Z'),
        status: 'CLOSING',
      },
    };

    const event = await service.prepareEndorsementDebitNoteIssued(
      actor,
      endorsementDebitNote,
      new Date('2026-06-11T13:00:00.000Z'),
    );

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'ENDORSEMENT_DEBIT_NOTE_ISSUED',
      sourceRecordType: 'PlacementNote',
      sourceRecordId: 'endorsement-debit-note-1',
      sourceDocumentId: 'endorsement-debit-note-1',
      idempotencyKey:
        'reinsurance:endorsement-debit-note:endorsement-debit-note-1:issued:v1',
      occurredAt: '2026-06-11T13:00:00.000Z',
      currency: 'GHS',
    });
    if (!event) throw new Error('Expected ENDORSEMENT_DEBIT_NOTE_ISSUED event');
    const payload = event.payload as {
      references: Record<string, unknown>;
      counterparty: Record<string, unknown>;
      amounts: Record<string, unknown>;
      endorsement: Record<string, unknown>;
      note: Record<string, unknown>;
    };
    expect(payload.references).toMatchObject({
      placementId: 'placement-1',
      endorsementId: 'endorsement-1',
      endorsementReference: 'END-001',
      noteNumber: 'EDN-001',
    });
    expect(payload.counterparty).toMatchObject({
      id: 'cedant-1',
      type: CounterpartyType.CEDANT,
      subledgerExternalRef: 'cedant-1',
    });
    expect(payload.amounts).toMatchObject({
      grossPremiumAdjustment: 2500,
      commissionAdjustment: 250,
      netPremiumAdjustment: 2250,
      adjustmentMagnitude: 2250,
      signedReceivableImpact: 2250,
      signedPayableImpact: 0,
    });
    expect(payload.endorsement).toMatchObject({
      id: 'endorsement-1',
      reference: 'END-001',
      effectiveDate: '2026-06-10T00:00:00.000Z',
    });
    expect(payload.note).toMatchObject({
      type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      direction: PlacementNoteDirection.CEDANT_TO_BROKER,
      status: PlacementNoteStatus.ISSUED,
    });
  });

  it('prepares ENDORSEMENT_CREDIT_NOTE_ISSUED from a return-premium endorsement credit note snapshot', async () => {
    const { actor, service } = makeService();
    const endorsementCreditNote = {
      ...note,
      id: 'endorsement-credit-note-1',
      endorsementId: 'endorsement-1',
      endorsementClosingId: 'endorsement-closing-1',
      endorsementParticipantId: 'endorsement-participant-1',
      counterpartyId: 'reinsurer-1',
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      noteNumber: 'ECN-001',
      grossAmount: new Prisma.Decimal('-1800.00'),
      commissionAmount: new Prisma.Decimal('-180.00'),
      brokerageAmount: new Prisma.Decimal('0.00'),
      netAmount: new Prisma.Decimal('-1620.00'),
      counterparty: {
        id: 'reinsurer-1',
        type: CounterpartyType.REINSURER,
        name: 'Reliable Re',
        registrationNumber: 'RE-001',
      },
      endorsement: {
        id: 'endorsement-1',
        endorsementNumber: 'END-001',
        type: 'CAPACITY_CHANGE',
        impactType: 'DECREASE_OR_CANCELLATION',
        effectiveDate: new Date('2026-06-10T00:00:00.000Z'),
        status: 'CLOSING',
      },
      endorsementClosing: {
        id: 'endorsement-closing-1',
        closingNumber: 'ECLO-001',
        endorsementParticipantId: 'endorsement-participant-1',
      },
    };

    const event = await service.prepareEndorsementCreditNoteIssued(
      actor,
      endorsementCreditNote,
      new Date('2026-06-11T13:00:00.000Z'),
    );

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'ENDORSEMENT_CREDIT_NOTE_ISSUED',
      sourceRecordType: 'PlacementNote',
      sourceRecordId: 'endorsement-credit-note-1',
      sourceDocumentId: 'endorsement-credit-note-1',
      idempotencyKey:
        'reinsurance:endorsement-credit-note:endorsement-credit-note-1:issued:v1',
      occurredAt: '2026-06-11T13:00:00.000Z',
      currency: 'GHS',
    });
    if (!event) {
      throw new Error('Expected ENDORSEMENT_CREDIT_NOTE_ISSUED event');
    }
    const payload = event.payload as {
      references: Record<string, unknown>;
      counterparty: Record<string, unknown>;
      amounts: Record<string, unknown>;
      note: Record<string, unknown>;
    };
    expect(payload.references).toMatchObject({
      endorsementId: 'endorsement-1',
      endorsementReference: 'END-001',
      endorsementClosingId: 'endorsement-closing-1',
      endorsementClosingNumber: 'ECLO-001',
      endorsementParticipantId: 'endorsement-participant-1',
      noteNumber: 'ECN-001',
    });
    expect(payload.counterparty).toMatchObject({
      id: 'reinsurer-1',
      type: CounterpartyType.REINSURER,
      subledgerExternalRef: 'reinsurer-1',
    });
    expect(payload.amounts).toMatchObject({
      rawGrossPremiumAdjustment: -1800,
      rawCommissionAdjustment: -180,
      rawNetPremiumAdjustment: -1620,
      grossPremiumAdjustment: 1800,
      commissionAdjustment: 180,
      netPremiumAdjustment: -1620,
      adjustmentMagnitude: 1620,
      returnPremiumMagnitude: 1620,
      signedReceivableImpact: 0,
      signedPayableImpact: 1620,
    });
    expect(payload.note).toMatchObject({
      type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      direction: PlacementNoteDirection.BROKER_TO_REINSURER,
      amountRepresentation: 'POSITIVE_MAGNITUDE_WITH_SIGNED_IMPACTS',
    });
  });

  it('rejects endorsement events when the note has no endorsement association', async () => {
    const { actor, service } = makeService();

    await expect(
      service.prepareEndorsementDebitNoteIssued(
        actor,
        {
          ...note,
          type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
          direction: PlacementNoteDirection.CEDANT_TO_BROKER,
          endorsementId: null,
        },
        new Date('2026-06-11T13:00:00.000Z'),
      ),
    ).rejects.toThrow(
      'Note note-1 is not a valid issued endorsement debit note',
    );
  });

  it('captures the event even when delivery configuration is missing', async () => {
    const { actor, service } = makeService();

    const event = await service.prepareDebitNoteIssued(
      actor,
      note,
      new Date('2026-06-04T13:00:00.000Z'),
    );

    expect(event?.sourceEventType).toBe('DEBIT_NOTE_ISSUED');
    expect(event?.idempotencyKey).toBe(
      'reinsurance:debit-note:note-1:issued:v1',
    );
  });

  it('prepares a PREMIUM_PAYMENT_RECEIVED event from the recorded payment row', () => {
    const { actor, service } = makeService();

    const event = service.preparePremiumPaymentReceived(actor, payment);

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: 'payment-1',
      sourceDocumentId: 'payment-1',
      idempotencyKey: 'reinsurance:payment:payment-1:recorded:v1',
      occurredAt: '2026-06-05T10:30:00.000Z',
      currency: 'GHS',
      payload: {
        transactionDate: '2026-06-05T10:30:00.000Z',
        references: {
          placementId: 'placement-1',
          placementReference: 'FAC-2026-001',
          policyNumber: 'POL-001',
          paymentId: 'payment-1',
        },
        counterparty: {
          id: 'cedant-1',
          type: CounterpartyType.CEDANT,
          name: 'Acme Insurance',
          subledgerExternalRef: 'cedant-1',
        },
        amounts: {
          paymentAmount: 1000,
          signedCashImpact: 1000,
          signedReceivableImpact: -1000,
        },
        allocation: {
          model: 'PLACEMENT_LEVEL_RECEIVABLE',
          noteAllocationSupported: false,
          noteId: null,
          noteNumber: null,
        },
      },
    });
  });

  it('prepares a PAYMENT_REVERSED event from the reversal payment row', () => {
    const { actor, service } = makeService();
    const reversal = {
      ...payment,
      id: 'payment-reversal-1',
      amount: new Prisma.Decimal('-1000.00'),
      paymentDate: new Date('2026-06-06T10:30:00.000Z'),
      reference: 'REVERSAL-BANK-001',
      notes: 'Payment reversal',
      reversalOfPaymentId: 'payment-1',
      reversalOfPayment: {
        id: 'payment-1',
        amount: payment.amount,
        currency: payment.currency,
        paymentDate: payment.paymentDate,
        reference: payment.reference,
        status: PlacementPaymentStatus.REVERSED,
      },
    };

    const event = service.preparePaymentReversed(actor, reversal);

    expect(event).toMatchObject({
      tenantId: 'tenant-1',
      sourceEventType: 'PAYMENT_REVERSED',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: 'payment-reversal-1',
      sourceDocumentId: 'payment-reversal-1',
      idempotencyKey: 'reinsurance:payment:payment-reversal-1:reversal:v1',
      occurredAt: '2026-06-06T10:30:00.000Z',
      currency: 'GHS',
      payload: {
        references: {
          originalPaymentId: 'payment-1',
          reversalPaymentId: 'payment-reversal-1',
        },
        amounts: {
          paymentAmount: 1000,
          originalPaymentAmount: 1000,
          signedCashImpact: -1000,
          signedReceivableImpact: 1000,
        },
        payment: {
          id: 'payment-reversal-1',
          originalPaymentId: 'payment-1',
          reversalPaymentId: 'payment-reversal-1',
          isReversal: true,
        },
      },
    });
  });

  it('enqueues prepared events through the transactional outbox', async () => {
    const { outbox, service } = makeService();
    const tx = {} as Prisma.TransactionClient;
    const event = {
      tenantId: 'tenant-1',
      sourceEventType: 'DEBIT_NOTE_ISSUED',
      sourceRecordType: 'PlacementNote',
      sourceRecordId: 'note-1',
      sourceDocumentId: 'note-1',
      idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
      occurredAt: '2026-06-04T13:00:00.000Z',
      currency: 'GHS',
      payload: { amounts: { netPremium: 8550 } },
    };

    await service.enqueuePreparedEvent(tx, event);

    expect(outbox.enqueueAccountingEvent).toHaveBeenCalledWith(tx, event);
  });
});
