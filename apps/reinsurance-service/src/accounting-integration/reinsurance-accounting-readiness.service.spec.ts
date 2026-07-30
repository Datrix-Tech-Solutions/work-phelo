import { RequestUser } from '@work-phelo/types';
import {
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  Prisma,
  ReinsuranceAccountingOutboxStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReinsuranceAccountingClient } from './reinsurance-accounting-client';
import { ReinsuranceAccountingOutboxService } from './reinsurance-accounting-outbox.service';
import { ReinsuranceAccountingReadinessService } from './reinsurance-accounting-readiness.service';
import { ReinsuranceFinancialEventPublisher } from './reinsurance-financial-event-publisher.service';

describe('ReinsuranceAccountingReadinessService', () => {
  type PlacementNoteFindManyArg = {
    take?: number;
    where?: Record<string, unknown>;
  };

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

  const issuedNote = {
    id: 'note-1',
    tenantId: 'tenant-1',
    placementId: 'placement-1',
    counterpartyId: 'cedant-1',
    type: PlacementNoteType.DEBIT_NOTE,
    direction: PlacementNoteDirection.CEDANT_TO_BROKER,
    noteNumber: 'DN-001',
    status: PlacementNoteStatus.ISSUED,
    currency: 'GHS',
    grossAmount: new Prisma.Decimal('10000.00'),
    commissionPercent: null,
    commissionAmount: new Prisma.Decimal('1000.00'),
    brokeragePercent: null,
    brokerageAmount: new Prisma.Decimal('500.00'),
    nicLevyPercent: new Prisma.Decimal('0.0000'),
    nicLevyAmount: new Prisma.Decimal('0.00'),
    withholdingTaxPercent: new Prisma.Decimal('0.0000'),
    withholdingTaxAmount: new Prisma.Decimal('0.00'),
    netAmount: new Prisma.Decimal('8500.00'),
    appliedCharges: null,
    noteDate: new Date('2026-06-04T12:00:00.000Z'),
    issuedAt: new Date('2026-06-04T13:00:00.000Z'),
    counterparty: {
      id: 'cedant-1',
      type: 'CEDANT',
      name: 'Acme Insurance',
      registrationNumber: null,
    },
  };

  const makeService = (
    notes: unknown[] = [issuedNote],
    existingOutbox: unknown[] = [],
  ) => {
    const prisma: {
      placementNote: {
        findMany: jest.Mock<Promise<unknown[]>, [PlacementNoteFindManyArg]>;
      };
      reinsuranceAccountingOutbox: { findMany: jest.Mock };
      $transaction: jest.Mock;
    } = {
      placementNote: {
        findMany: jest
          .fn<Promise<unknown[]>, [PlacementNoteFindManyArg]>()
          .mockResolvedValue(notes),
      },
      reinsuranceAccountingOutbox: {
        findMany: jest.fn().mockResolvedValue(existingOutbox),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: unknown) => unknown) => callback(prisma),
    );
    const client = {
      configurationStatus: jest.fn().mockReturnValue({
        configured: true,
        baseUrlConfigured: true,
        serviceAuthSecretConfigured: true,
      }),
    };
    const outbox = {
      processPending: jest.fn(),
    };
    const financialEvents = {
      prepareDebitNoteIssued: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        sourceEventType: 'DEBIT_NOTE_ISSUED',
        sourceRecordType: 'PlacementNote',
        sourceRecordId: 'note-1',
        sourceDocumentId: 'note-1',
        idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
        occurredAt: '2026-06-04T13:00:00.000Z',
        currency: 'GHS',
        payload: { amounts: { netPremium: 8500 } },
      }),
      enqueuePreparedEvent: jest.fn().mockResolvedValue({
        id: 'outbox-1',
        status: ReinsuranceAccountingOutboxStatus.PENDING,
        accountingSourceEventId: null,
      }),
    };
    const service = new ReinsuranceAccountingReadinessService(
      prisma as unknown as PrismaService,
      client as unknown as ReinsuranceAccountingClient,
      outbox as unknown as ReinsuranceAccountingOutboxService,
      financialEvents as unknown as ReinsuranceFinancialEventPublisher,
    );

    return { financialEvents, prisma, service };
  };

  it('dry-runs issued debit notes missing their deterministic outbox row', async () => {
    const { financialEvents, prisma, service } = makeService();

    const result = await service.reconcileDebitNoteIssuedEvents(user, {
      dryRun: true,
      limit: 10,
    });

    const findManyArg = prisma.placementNote.findMany.mock.calls[0]?.[0];
    if (!findManyArg) {
      throw new Error('Expected placementNote.findMany to be called');
    }
    expect(findManyArg.take).toBe(10);
    expect(findManyArg.where).toMatchObject({
      tenantId: 'tenant-1',
      type: PlacementNoteType.DEBIT_NOTE,
      status: PlacementNoteStatus.ISSUED,
      issuedAt: { not: null },
    });
    expect(result.accountingEnabled).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.inspectedCount).toBe(1);
    expect(result.missingCount).toBe(1);
    expect(result.enqueuedCount).toBe(0);
    expect(result.items[0]).toMatchObject({
      noteId: 'note-1',
      status: 'MISSING',
      idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
    });
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });

  it('does not report notes that already have matching outbox events', async () => {
    const { service } = makeService(
      [issuedNote],
      [
        {
          id: 'outbox-1',
          idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
          status: ReinsuranceAccountingOutboxStatus.DELIVERED,
          accountingSourceEventId: 'accounting-event-1',
        },
      ],
    );

    const result = await service.reconcileDebitNoteIssuedEvents(user, {
      dryRun: true,
    });

    expect(result).toMatchObject({
      missingCount: 0,
      enqueuedCount: 0,
      items: [
        expect.objectContaining({
          noteId: 'note-1',
          status: 'PRESENT',
          outboxId: 'outbox-1',
          accountingSourceEventId: 'accounting-event-1',
        }),
      ],
    });
  });

  it('enqueues missing debit-note events explicitly with the original business date', async () => {
    const { financialEvents, service } = makeService();

    const result = await service.reconcileDebitNoteIssuedEvents(user, {
      dryRun: false,
    });

    expect(financialEvents.prepareDebitNoteIssued).toHaveBeenCalledWith(
      user,
      issuedNote,
      issuedNote.issuedAt,
    );
    expect(financialEvents.enqueuePreparedEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
        occurredAt: '2026-06-04T13:00:00.000Z',
      }),
    );
    expect(result).toMatchObject({
      dryRun: false,
      missingCount: 0,
      enqueuedCount: 1,
      items: [
        expect.objectContaining({
          noteId: 'note-1',
          status: 'ENQUEUED',
          outboxId: 'outbox-1',
        }),
      ],
    });
  });

  it('does not inspect or enqueue events when Accounting is disabled', async () => {
    const { financialEvents, prisma, service } = makeService();
    const disabledUser = {
      ...user,
      moduleConfig: { accounting: false },
    } as RequestUser;

    const result = await service.reconcileDebitNoteIssuedEvents(disabledUser, {
      dryRun: false,
    });

    expect(result).toMatchObject({
      accountingEnabled: false,
      inspectedCount: 0,
      enqueuedCount: 0,
    });
    expect(prisma.placementNote.findMany).not.toHaveBeenCalled();
    expect(financialEvents.enqueuePreparedEvent).not.toHaveBeenCalled();
  });
});
