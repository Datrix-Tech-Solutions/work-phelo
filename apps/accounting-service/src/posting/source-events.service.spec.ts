import { BadRequestException, ConflictException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  FiscalPeriodStatus,
  PostingDirection,
  Prisma,
  SourceEventStatus,
  SubledgerType,
} from '../../prisma/generated/client';
import { JournalsService } from '../ledger/journals.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSourceEventDto } from './dto/posting.dto';
import { SourceEventsService } from './source-events.service';

describe('SourceEventsService', () => {
  const actor = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'accountant@example.com',
    role: 'EMPLOYEE',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    firstName: 'Amina',
    moduleConfig: { accounting: true },
    featureConfig: {},
    permissions: [],
  } as RequestUser;

  const dto: CreateSourceEventDto = {
    sourceModule: 'OPERATIONS',
    sourceEventType: 'RECEIPT_ISSUED',
    sourceRecordId: 'receipt-1',
    sourceDocumentId: 'document-1',
    idempotencyKey: 'operations:receipt-1:issued:v1',
    payload: {
      transactionDate: '2026-07-05T10:00:00.000Z',
      currency: 'GHS',
      amounts: { receivable: 100, revenue: 100 },
      counterparty: { id: 'customer-1' },
      reference: 'RCPT-001',
    },
  };

  const rule = {
    id: 'rule-1',
    tenantId: actor.tenantId,
    name: 'Receipt issued',
    sourceModule: dto.sourceModule,
    sourceEventType: dto.sourceEventType,
    version: 1,
    active: true,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    createdByUserId: actor.id,
    updatedByUserId: actor.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [
      {
        id: 'rule-line-1',
        tenantId: actor.tenantId,
        postingRuleId: 'rule-1',
        sequence: 1,
        direction: PostingDirection.DR,
        glAccountId: 'receivable-account',
        subledgerType: null,
        subledgerExternalRefSource: null,
        amountSource: 'amounts.receivable',
        currencySource: 'currency',
        descriptionTemplate:
          'Receivable {{payload.reference}} for {{sourceRecordId}}',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'rule-line-2',
        tenantId: actor.tenantId,
        postingRuleId: 'rule-1',
        sequence: 2,
        direction: PostingDirection.CR,
        glAccountId: 'revenue-account',
        subledgerType: null,
        subledgerExternalRefSource: null,
        amountSource: 'amounts.revenue',
        currencySource: 'currency',
        descriptionTemplate: 'Revenue {{payload.reference}}',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  function setup(
    initialStatus: SourceEventStatus = SourceEventStatus.RECEIVED,
    seedDto: CreateSourceEventDto = dto,
  ) {
    const event = {
      id: 'event-1',
      tenantId: actor.tenantId,
      sourceModule: seedDto.sourceModule,
      sourceEventType: seedDto.sourceEventType,
      sourceRecordId: seedDto.sourceRecordId,
      sourceDocumentId: seedDto.sourceDocumentId ?? null,
      idempotencyKey: seedDto.idempotencyKey,
      payload: seedDto.payload as Prisma.JsonObject,
      status: initialStatus,
      failureReason:
        initialStatus === SourceEventStatus.FAILED ? 'Previous failure' : null,
      postingRuleId: null as string | null,
      journalEntryId: null as string | null,
      retryCount: 0,
      receivedByUserId: actor.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      processedAt: null as Date | null,
    };
    const journal = {
      id: 'journal-1',
      journalNumber: 'AUTO-001',
      status: 'POSTED',
    };

    const sourceEventInbox = {
      create: jest.fn().mockImplementation(() => {
        event.status = SourceEventStatus.RECEIVED;
        return { ...event };
      }),
      findUnique: jest.fn(),
      findFirst: jest.fn().mockImplementation(
        ({
          where,
        }: {
          where: {
            id?: string;
            tenantId?: string;
            status?: SourceEventStatus;
          };
        }) => {
          if (
            where.id === event.id &&
            where.tenantId === event.tenantId &&
            (!where.status || where.status === event.status)
          ) {
            return { ...event };
          }
          return null;
        },
      ),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn().mockImplementation(() => ({ ...event })),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          Object.assign(event, data);
          return { ...event };
        }),
      updateMany: jest.fn().mockImplementation(
        ({
          where,
          data,
        }: {
          where: {
            id?: string;
            tenantId?: string;
            status?: SourceEventStatus;
          };
          data: Record<string, unknown> & {
            retryCount?: { increment: number };
          };
        }) => {
          if (
            where.id !== event.id ||
            where.tenantId !== event.tenantId ||
            (where.status && where.status !== event.status)
          ) {
            return { count: 0 };
          }
          if (data.retryCount?.increment) {
            event.retryCount += data.retryCount.increment;
          }
          Object.assign(event, {
            ...data,
            retryCount: event.retryCount,
          });
          return { count: 1 };
        },
      ),
    };
    const prisma = {
      sourceEventInbox,
      postingRule: {
        findFirst: jest.fn().mockResolvedValue(rule),
      },
      fiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'period-1',
          tenantId: actor.tenantId,
          status: FiscalPeriodStatus.OPEN,
          startDate: new Date('2026-07-01T00:00:00.000Z'),
          endDate: new Date('2026-07-31T23:59:59.999Z'),
        }),
      },
      subledgerAccount: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    const journals = {
      createPostedInTransaction: jest.fn().mockResolvedValue(journal),
    };
    const service = new SourceEventsService(
      prisma as unknown as PrismaService,
      journals as unknown as JournalsService,
    );
    return { event, journal, journals, prisma, service };
  }

  it('generates and posts a balanced journal from the active rule', async () => {
    const { event, journals, service } = setup();

    const result = await service.receive(actor, dto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(event.journalEntryId).toBe('journal-1');
    expect(journals.createPostedInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({
        transactionCurrency: 'GHS',
        fiscalPeriodId: 'period-1',
        idempotencyKey: 'source-event:event-1',
        lines: [
          expect.objectContaining({
            glAccountId: 'receivable-account',
            debit: 100,
            credit: 0,
            description: 'Receivable RCPT-001 for receipt-1',
          }),
          expect.objectContaining({
            glAccountId: 'revenue-account',
            debit: 0,
            credit: 100,
          }),
        ],
      }),
    );
  });

  it('posts REINSURANCE DEBIT_NOTE_ISSUED using the cedant subledger reference', async () => {
    const reinsuranceDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'DEBIT_NOTE_ISSUED',
      sourceRecordId: 'note-1',
      sourceDocumentId: 'note-1',
      idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
      payload: {
        transactionDate: '2026-07-05T10:00:00.000Z',
        currency: 'GHS',
        references: {
          placementId: 'placement-1',
          placementReference: 'FAC-2026-001',
          noteNumber: 'DN-001',
        },
        counterparty: { id: 'cedant-1', type: 'CEDANT' },
        amounts: { netPremium: 8550 },
      },
    };
    const reinsuranceRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'DEBIT_NOTE_ISSUED',
      lines: [
        {
          ...rule.lines[0],
          direction: PostingDirection.DR,
          glAccountId: 'cedant-premium-receivable',
          subledgerType: SubledgerType.CEDANT,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.netPremium',
          currencySource: 'currency',
          descriptionTemplate:
            'Debit note {{payload.references.noteNumber}} for {{payload.references.placementReference}}',
        },
        {
          ...rule.lines[1],
          direction: PostingDirection.CR,
          glAccountId: 'premium-clearing',
          subledgerType: null,
          subledgerExternalRefSource: null,
          amountSource: 'amounts.netPremium',
          currencySource: 'currency',
          descriptionTemplate:
            'Premium clearing {{payload.references.noteNumber}}',
        },
      ],
    };
    const { journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      reinsuranceDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(reinsuranceRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue({
      id: 'cedant-subledger-1',
    });

    const result = await service.receive(actor, reinsuranceDto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(prisma.subledgerAccount.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        type: SubledgerType.CEDANT,
        externalRef: 'cedant-1',
        status: 'ACTIVE',
      },
    });
    expect(journals.createPostedInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({
        sourceModule: 'REINSURANCE',
        sourceRecordType: 'DEBIT_NOTE_ISSUED',
        sourceRecordId: 'note-1',
        lines: [
          expect.objectContaining({
            glAccountId: 'cedant-premium-receivable',
            subledgerAccountId: 'cedant-subledger-1',
            debit: 8550,
            credit: 0,
            description: 'Debit note DN-001 for FAC-2026-001',
          }),
          expect.objectContaining({
            glAccountId: 'premium-clearing',
            debit: 0,
            credit: 8550,
          }),
        ],
      }),
    );
  });

  it('fails REINSURANCE DEBIT_NOTE_ISSUED cleanly when the cedant subledger is missing', async () => {
    const reinsuranceDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'DEBIT_NOTE_ISSUED',
      sourceRecordId: 'note-1',
      sourceDocumentId: 'note-1',
      idempotencyKey: 'reinsurance:debit-note:note-1:issued:v1',
      payload: {
        transactionDate: '2026-07-05T10:00:00.000Z',
        currency: 'GHS',
        counterparty: { id: 'cedant-1', type: 'CEDANT' },
        amounts: { netPremium: 8550 },
      },
    };
    const reinsuranceRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'DEBIT_NOTE_ISSUED',
      lines: [
        {
          ...rule.lines[0],
          subledgerType: SubledgerType.CEDANT,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.netPremium',
          currencySource: 'currency',
        },
        {
          ...rule.lines[1],
          amountSource: 'amounts.netPremium',
          currencySource: 'currency',
        },
      ],
    };
    const { event, journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      reinsuranceDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(reinsuranceRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue(null);

    const result = await service.receive(actor, reinsuranceDto);

    expect(result.status).toBe(SourceEventStatus.FAILED);
    expect(event.failureReason).toBe(
      'Active cedant subledger not found for rule line 1',
    );
    expect(journals.createPostedInTransaction).not.toHaveBeenCalled();
  });

  it('posts REINSURANCE CREDIT_NOTE_ISSUED using tenant-configured policy and reinsurer subledger', async () => {
    const creditNoteDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'CREDIT_NOTE_ISSUED',
      sourceRecordId: 'credit-note-1',
      sourceDocumentId: 'credit-note-1',
      idempotencyKey: 'reinsurance:credit-note:credit-note-1:issued:v1',
      payload: {
        transactionDate: '2026-07-05T10:00:00.000Z',
        currency: 'GHS',
        references: {
          placementId: 'placement-1',
          placementReference: 'FAC-2026-001',
          closingId: 'closing-1',
          noteNumber: 'CN-001',
        },
        counterparty: { id: 'reinsurer-1', type: 'REINSURER' },
        amounts: {
          creditMagnitude: 3712.5,
          signedReceivableImpact: 0,
          signedPayableImpact: 3712.5,
        },
      },
    };
    const creditNoteRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'CREDIT_NOTE_ISSUED',
      lines: [
        {
          ...rule.lines[0],
          direction: PostingDirection.DR,
          glAccountId: 'premium-clearing',
          subledgerType: null,
          subledgerExternalRefSource: null,
          amountSource: 'amounts.creditMagnitude',
          currencySource: 'currency',
          descriptionTemplate:
            'Credit note {{payload.references.noteNumber}} for {{payload.references.placementReference}}',
        },
        {
          ...rule.lines[1],
          direction: PostingDirection.CR,
          glAccountId: 'reinsurer-premium-payable',
          subledgerType: SubledgerType.REINSURER,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.creditMagnitude',
          currencySource: 'currency',
          descriptionTemplate:
            'Reinsurer credit {{payload.references.noteNumber}}',
        },
      ],
    };
    const { journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      creditNoteDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(creditNoteRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue({
      id: 'reinsurer-subledger-1',
    });

    const result = await service.receive(actor, creditNoteDto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(prisma.subledgerAccount.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        type: SubledgerType.REINSURER,
        externalRef: 'reinsurer-1',
        status: 'ACTIVE',
      },
    });
    expect(journals.createPostedInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({
        sourceModule: 'REINSURANCE',
        sourceRecordType: 'CREDIT_NOTE_ISSUED',
        sourceRecordId: 'credit-note-1',
        lines: [
          expect.objectContaining({
            glAccountId: 'premium-clearing',
            debit: 3712.5,
            credit: 0,
          }),
          expect.objectContaining({
            glAccountId: 'reinsurer-premium-payable',
            subledgerAccountId: 'reinsurer-subledger-1',
            debit: 0,
            credit: 3712.5,
          }),
        ],
      }),
    );
  });

  it('posts REINSURANCE PREMIUM_PAYMENT_RECEIVED using tenant-configured cash and receivable accounts', async () => {
    const paymentDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      sourceRecordId: 'payment-1',
      sourceDocumentId: 'payment-1',
      idempotencyKey: 'reinsurance:payment:payment-1:recorded:v1',
      payload: {
        transactionDate: '2026-07-05T10:00:00.000Z',
        currency: 'GHS',
        references: {
          placementId: 'placement-1',
          placementReference: 'FAC-2026-001',
          paymentId: 'payment-1',
        },
        counterparty: { id: 'cedant-1', type: 'CEDANT' },
        amounts: {
          paymentAmount: 8500,
          signedCashImpact: 8500,
          signedReceivableImpact: -8500,
        },
      },
    };
    const paymentRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      lines: [
        {
          ...rule.lines[0],
          direction: PostingDirection.DR,
          glAccountId: 'bank-clearing',
          subledgerType: null,
          subledgerExternalRefSource: null,
          amountSource: 'amounts.paymentAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Premium payment {{payload.references.paymentId}} for {{payload.references.placementReference}}',
        },
        {
          ...rule.lines[1],
          direction: PostingDirection.CR,
          glAccountId: 'cedant-premium-receivable',
          subledgerType: SubledgerType.CEDANT,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.paymentAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Clear cedant receivable {{payload.references.paymentId}}',
        },
      ],
    };
    const { journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      paymentDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(paymentRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue({
      id: 'cedant-subledger-1',
    });

    const result = await service.receive(actor, paymentDto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(journals.createPostedInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({
        sourceModule: 'REINSURANCE',
        sourceRecordType: 'PREMIUM_PAYMENT_RECEIVED',
        sourceRecordId: 'payment-1',
        lines: [
          expect.objectContaining({
            glAccountId: 'bank-clearing',
            debit: 8500,
            credit: 0,
          }),
          expect.objectContaining({
            glAccountId: 'cedant-premium-receivable',
            subledgerAccountId: 'cedant-subledger-1',
            debit: 0,
            credit: 8500,
          }),
        ],
      }),
    );
  });

  it('posts REINSURANCE PAYMENT_REVERSED as a separate reversing journal', async () => {
    const reversalDto: CreateSourceEventDto = {
      sourceModule: 'REINSURANCE',
      sourceEventType: 'PAYMENT_REVERSED',
      sourceRecordId: 'payment-reversal-1',
      sourceDocumentId: 'payment-reversal-1',
      idempotencyKey: 'reinsurance:payment:payment-reversal-1:reversal:v1',
      payload: {
        transactionDate: '2026-07-06T10:00:00.000Z',
        currency: 'GHS',
        references: {
          placementId: 'placement-1',
          placementReference: 'FAC-2026-001',
          originalPaymentId: 'payment-1',
          reversalPaymentId: 'payment-reversal-1',
        },
        counterparty: { id: 'cedant-1', type: 'CEDANT' },
        amounts: {
          paymentAmount: 8500,
          signedCashImpact: -8500,
          signedReceivableImpact: 8500,
        },
      },
    };
    const reversalRule = {
      ...rule,
      sourceModule: 'REINSURANCE',
      sourceEventType: 'PAYMENT_REVERSED',
      lines: [
        {
          ...rule.lines[0],
          direction: PostingDirection.DR,
          glAccountId: 'cedant-premium-receivable',
          subledgerType: SubledgerType.CEDANT,
          subledgerExternalRefSource: 'counterparty.id',
          amountSource: 'amounts.paymentAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Reverse payment {{payload.references.reversalPaymentId}}',
        },
        {
          ...rule.lines[1],
          direction: PostingDirection.CR,
          glAccountId: 'bank-clearing',
          subledgerType: null,
          subledgerExternalRefSource: null,
          amountSource: 'amounts.paymentAmount',
          currencySource: 'currency',
          descriptionTemplate:
            'Reverse cash {{payload.references.originalPaymentId}}',
        },
      ],
    };
    const { journals, prisma, service } = setup(
      SourceEventStatus.RECEIVED,
      reversalDto,
    );
    prisma.postingRule.findFirst.mockResolvedValue(reversalRule);
    prisma.subledgerAccount.findFirst.mockResolvedValue({
      id: 'cedant-subledger-1',
    });

    const result = await service.receive(actor, reversalDto);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(journals.createPostedInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({
        sourceModule: 'REINSURANCE',
        sourceRecordType: 'PAYMENT_REVERSED',
        sourceRecordId: 'payment-reversal-1',
        idempotencyKey: 'source-event:event-1',
        lines: [
          expect.objectContaining({
            glAccountId: 'cedant-premium-receivable',
            subledgerAccountId: 'cedant-subledger-1',
            debit: 8500,
            credit: 0,
          }),
          expect.objectContaining({
            glAccountId: 'bank-clearing',
            debit: 0,
            credit: 8500,
          }),
        ],
      }),
    );
  });

  it('rejects a duplicate tenant idempotency key safely', async () => {
    const { prisma, service } = setup();
    prisma.sourceEventInbox.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
    );
    prisma.sourceEventInbox.findUnique.mockResolvedValue({
      id: 'existing-event',
      status: SourceEventStatus.POSTED,
    });

    try {
      await service.receive(actor, dto);
      fail('Expected duplicate idempotency conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      const response = (error as ConflictException).getResponse();
      expect(response).toMatchObject({
        message: 'Source event idempotency key already exists',
        sourceEventId: 'existing-event',
      });
    }
  });

  it('marks an event failed when no posting rule is configured', async () => {
    const { event, journals, prisma, service } = setup();
    prisma.postingRule.findFirst.mockResolvedValue(null);

    const result = await service.receive(actor, dto);

    expect(result.status).toBe(SourceEventStatus.FAILED);
    expect(event.failureReason).toBe(
      'No posting rule is configured for this source event',
    );
    expect(journals.createPostedInTransaction).not.toHaveBeenCalled();
  });

  it('distinguishes an inactive posting rule', async () => {
    const { event, prisma, service } = setup();
    prisma.postingRule.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...rule, active: false, lines: undefined });

    await service.receive(actor, dto);

    expect(event.status).toBe(SourceEventStatus.FAILED);
    expect(event.failureReason).toBe(
      'No active posting rule is available for this source event',
    );
  });

  it('distinguishes a rule outside its effective dates', async () => {
    const { event, prisma, service } = setup();
    prisma.postingRule.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...rule, lines: undefined });

    await service.receive(actor, dto);

    expect(event.status).toBe(SourceEventStatus.FAILED);
    expect(event.failureReason).toBe(
      'No posting rule is effective for the source event transaction date',
    );
  });

  it('does not leave a journal when account validation fails', async () => {
    const { event, journals, service } = setup();
    journals.createPostedInTransaction.mockRejectedValue(
      new BadRequestException('Invalid posting account'),
    );

    await service.receive(actor, dto);

    expect(event.status).toBe(SourceEventStatus.FAILED);
    expect(event.failureReason).toBe('Invalid posting account');
    expect(event.journalEntryId).toBeNull();
  });

  it('rejects a source event in a closed fiscal period', async () => {
    const { event, journals, prisma, service } = setup();
    prisma.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      status: FiscalPeriodStatus.CLOSED,
    });

    await service.receive(actor, dto);

    expect(event.status).toBe(SourceEventStatus.FAILED);
    expect(event.failureReason).toBe(
      'Cannot post source event into a closed fiscal period',
    );
    expect(journals.createPostedInTransaction).not.toHaveBeenCalled();
  });

  it('scopes event detail to the requesting tenant', async () => {
    const { prisma, service } = setup();

    await service.findOne(actor.tenantId, 'event-1');

    expect(prisma.sourceEventInbox.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event-1', tenantId: actor.tenantId },
      }),
    );
  });

  it('retries a failed event and posts it once', async () => {
    const { event, service } = setup(SourceEventStatus.FAILED);

    const result = await service.retry(actor, event.id);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(event.retryCount).toBe(1);
    expect(event.failureReason).toBeNull();
  });

  it('returns a failed status when retry processing fails again', async () => {
    const { event, journals, service } = setup(SourceEventStatus.FAILED);
    journals.createPostedInTransaction.mockRejectedValue(
      new BadRequestException('GL account is inactive'),
    );

    const result = await service.retry(actor, event.id);

    expect(result.status).toBe(SourceEventStatus.FAILED);
    expect(event.retryCount).toBe(1);
    expect(event.failureReason).toBe('GL account is inactive');
  });

  it('returns the posted event when a successful retry is repeated', async () => {
    const { event, journals, service } = setup(SourceEventStatus.POSTED);
    event.journalEntryId = 'journal-1';

    const result = await service.retry(actor, event.id);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(journals.createPostedInTransaction).not.toHaveBeenCalled();
  });

  it('prevents concurrent processing of the same source event', async () => {
    const { event, service } = setup(SourceEventStatus.PROCESSING);

    await expect(service.retry(actor, event.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('processes a pending internal event into a posted journal', async () => {
    const { event, service } = setup(SourceEventStatus.RECEIVED);

    const result = await service.processOne(actor, event.id);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(event.journalEntryId).toBe('journal-1');
  });

  it('does not double-post an already posted event', async () => {
    const { event, journals, service } = setup(SourceEventStatus.POSTED);
    event.journalEntryId = 'journal-1';

    const result = await service.processOne(actor, event.id);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(journals.createPostedInTransaction).not.toHaveBeenCalled();
  });

  it('processes failed events through the single-event process endpoint', async () => {
    const { event, service } = setup(SourceEventStatus.FAILED);

    const result = await service.processOne(actor, event.id);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(event.retryCount).toBe(1);
  });

  it('stores a failure reason when single-event processing fails', async () => {
    const { event, journals, service } = setup(SourceEventStatus.RECEIVED);
    journals.createPostedInTransaction.mockRejectedValue(
      new BadRequestException('Missing premium clearing account'),
    );

    const result = await service.processOne(actor, event.id);

    expect(result.status).toBe(SourceEventStatus.FAILED);
    expect(event.failureReason).toBe('Missing premium clearing account');
  });

  it('processes pending events with filters and limit', async () => {
    const { event, prisma, service } = setup(SourceEventStatus.RECEIVED);
    prisma.sourceEventInbox.findMany.mockResolvedValue([{ id: event.id }]);

    const result = await service.processPending(actor, {
      limit: 2,
      sourceModule: dto.sourceModule,
      sourceEventType: dto.sourceEventType,
    });

    expect(prisma.sourceEventInbox.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: actor.tenantId,
          status: SourceEventStatus.RECEIVED,
          sourceModule: dto.sourceModule,
          sourceEventType: dto.sourceEventType,
        },
        take: 2,
      }),
    );
    expect(result).toMatchObject({
      processedCount: 1,
      postedCount: 1,
      failedCount: 0,
      skippedCount: 0,
    });
  });

  it('caps pending processing batches at 100 events', async () => {
    const { prisma, service } = setup(SourceEventStatus.RECEIVED);
    prisma.sourceEventInbox.findMany.mockResolvedValue([]);

    await service.processPending(actor, { limit: 500 });

    expect(prisma.sourceEventInbox.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it('safely retries a stale processing claim', async () => {
    const { event, service } = setup(SourceEventStatus.PROCESSING);
    event.updatedAt = new Date(Date.now() - 20 * 60 * 1000);

    const result = await service.processOne(actor, event.id);

    expect(result.status).toBe(SourceEventStatus.POSTED);
    expect(event.retryCount).toBe(1);
  });
});
