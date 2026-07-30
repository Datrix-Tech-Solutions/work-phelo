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
