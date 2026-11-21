import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma, RecordStatus } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { BankReconciliationsService } from './bank-reconciliations.service';
import { CompleteBankReconciliationDto } from './dto/bank-reconciliations.dto';

describe('BankReconciliationsService', () => {
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

  const dto: CompleteBankReconciliationDto = {
    cashAccountId: 'cash-account-1',
    statementReference: 'ECOBANK-2026-08',
    statementStartDate: '2026-08-01',
    statementEndDate: '2026-08-31',
    openingBalance: 1000,
    closingBalance: 1250,
    currency: 'GHS',
    reconciledJournalLineIds: ['journal-line-1'],
    statementLines: [
      {
        transactionDate: '2026-08-05',
        amount: 250,
        description: 'Premium receipt',
        reconciled: true,
      },
      {
        transactionDate: '2026-08-20',
        amount: -10,
        description: 'Bank charge',
      },
    ],
  };

  function ledgerLine(overrides: Record<string, unknown> = {}) {
    return {
      id: 'journal-line-1',
      description: null,
      baseDebit: new Prisma.Decimal('250'),
      baseCredit: new Prisma.Decimal('0'),
      transactionDebit: new Prisma.Decimal('250'),
      transactionCredit: new Prisma.Decimal('0'),
      journalEntry: {
        id: 'journal-1',
        journalNumber: 'JE-1',
        transactionDate: new Date('2026-08-05T00:00:00.000Z'),
        reference: null,
        description: 'Premium receipt',
        baseCurrency: 'GHS',
        transactionCurrency: 'GHS',
      },
      ...overrides,
    };
  }

  const saved = {
    id: 'reconciliation-1',
    tenantId: actor.tenantId,
    cashAccountId: dto.cashAccountId,
    statementReference: dto.statementReference,
    statementStartDate: new Date('2026-08-01T00:00:00.000Z'),
    statementEndDate: new Date('2026-08-31T23:59:59.999Z'),
    currency: dto.currency,
    status: 'COMPLETED',
    statementLines: [],
  };

  function setup() {
    const transaction = {
      bankReconciliation: { create: jest.fn().mockResolvedValue(saved) },
      bankStatementLine: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      bankReconciledEntry: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      accountingAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const prisma = {
      accountingCashAccount: {
        findFirst: jest.fn().mockResolvedValue({
          id: dto.cashAccountId,
          currency: dto.currency,
          glAccountId: 'gl-cash',
          glAccount: { status: RecordStatus.ACTIVE },
        }),
      },
      journalLine: {
        findMany: jest.fn().mockResolvedValue([ledgerLine()]),
      },
      bankReconciliation: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(saved),
      },
      bankStatementLine: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      bankReconciledEntry: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest
        .fn()
        .mockImplementation((callback: (tx: typeof transaction) => unknown) =>
          callback(transaction),
        ),
    };
    return {
      prisma,
      transaction,
      service: new BankReconciliationsService(
        prisma as unknown as PrismaService,
      ),
    };
  }

  it('saves a completed reconciliation with matched and unmatched rows and audits it', async () => {
    const { transaction, service } = setup();

    await expect(service.complete(actor, dto)).resolves.toMatchObject({
      id: 'reconciliation-1',
    });

    const [createdArgs] = transaction.bankReconciliation.create.mock
      .calls[0] as [{ data: Record<string, unknown> }];
    expect(createdArgs.data).toMatchObject({
      status: 'COMPLETED',
      completedByUserId: actor.id,
    });
    const [createManyArgs] = transaction.bankStatementLine.createMany.mock
      .calls[0] as [{ data: Array<Record<string, unknown>> }];
    const rows = createManyArgs.data;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      lineNumber: 1,
      status: 'MATCHED',
    });
    expect(rows[1]).toMatchObject({
      lineNumber: 2,
      status: 'UNMATCHED',
    });
    expect(transaction.bankReconciledEntry.createMany).toHaveBeenCalledWith({
      data: [
        {
          tenantId: actor.tenantId,
          reconciliationId: 'reconciliation-1',
          journalLineId: 'journal-line-1',
        },
      ],
    });
    expect(transaction.accountingAuditLog.create).toHaveBeenCalledTimes(1);
  });

  it('generates a statement reference when none is given', async () => {
    const { transaction, service } = setup();

    await service.complete(actor, { ...dto, statementReference: undefined });

    const [createArgs] = transaction.bankReconciliation.create.mock
      .calls[0] as [{ data: { statementReference: string } }];
    expect(createArgs.data.statementReference).toMatch(
      /^REC-2026-08-01-2026-08-31-/,
    );
  });

  it('rejects a statement range whose start is after its end', async () => {
    const { service } = setup();

    await expect(
      service.complete(actor, { ...dto, statementStartDate: '2026-09-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a reconciliation currency that differs from its cash account', async () => {
    const { service } = setup();

    await expect(
      service.complete(actor, { ...dto, currency: 'USD' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inactive or unknown cash account', async () => {
    const { prisma, service } = setup();
    prisma.accountingCashAccount.findFirst.mockResolvedValue(null);

    await expect(service.complete(actor, dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects a ledger entry ticked off twice', async () => {
    const { service } = setup();

    await expect(
      service.complete(actor, {
        ...dto,
        reconciledJournalLineIds: ['journal-line-1', 'journal-line-1'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a ledger entry outside the cash account or period', async () => {
    const { prisma, transaction, service } = setup();
    prisma.journalLine.findMany.mockResolvedValue([]);

    await expect(service.complete(actor, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(transaction.bankReconciliation.create).not.toHaveBeenCalled();
  });

  it('rejects reconciled totals that do not agree', async () => {
    const { transaction, service } = setup();

    await expect(
      service.complete(actor, {
        ...dto,
        statementLines: [{ ...dto.statementLines[0], amount: 249 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.bankReconciliation.create).not.toHaveBeenCalled();
  });

  it('accepts several bank rows ticked off against one ledger entry', async () => {
    const { service } = setup();

    await expect(
      service.complete(actor, {
        ...dto,
        statementLines: [
          { transactionDate: '2026-08-05', amount: 100, reconciled: true },
          { transactionDate: '2026-08-05', amount: 150, reconciled: true },
        ],
      }),
    ).resolves.toBeDefined();
  });

  it('counts money out as the credit side of the ledger entry', async () => {
    const { prisma, service } = setup();
    prisma.journalLine.findMany.mockResolvedValue([
      ledgerLine({
        baseDebit: new Prisma.Decimal('0'),
        baseCredit: new Prisma.Decimal('10'),
      }),
    ]);

    await expect(
      service.complete(actor, {
        ...dto,
        statementLines: [
          { transactionDate: '2026-08-05', amount: -10, reconciled: true },
        ],
      }),
    ).resolves.toBeDefined();
  });

  it('allows a reconciliation with nothing ticked off', async () => {
    const { prisma, service } = setup();
    prisma.journalLine.findMany.mockResolvedValue([]);

    await expect(
      service.complete(actor, {
        ...dto,
        reconciledJournalLineIds: [],
        statementLines: [{ transactionDate: '2026-08-05', amount: 5 }],
      }),
    ).resolves.toBeDefined();
  });

  it('rejects ledger entries that were already reconciled', async () => {
    const { prisma, transaction, service } = setup();
    prisma.bankReconciledEntry.count.mockResolvedValue(1);

    await expect(service.complete(actor, dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction.bankReconciliation.create).not.toHaveBeenCalled();
  });

  it('maps a duplicate statement reference or racing match to a conflict', async () => {
    const { transaction, service } = setup();
    transaction.bankReconciliation.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
    );

    await expect(service.complete(actor, dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('lists reconciliations with matched and unmatched row counts', async () => {
    const { prisma, service } = setup();
    prisma.bankReconciliation.findMany.mockResolvedValue([saved]);
    prisma.bankStatementLine.groupBy.mockResolvedValue([
      {
        reconciliationId: 'reconciliation-1',
        status: 'MATCHED',
        _count: { _all: 3 },
      },
      {
        reconciliationId: 'reconciliation-1',
        status: 'UNMATCHED',
        _count: { _all: 2 },
      },
    ]);

    await expect(service.list(actor.tenantId, {})).resolves.toEqual([
      expect.objectContaining({ matchedLineCount: 3, unmatchedLineCount: 2 }),
    ]);
  });

  it('lists the ledger lines a cash account has already reconciled', async () => {
    const { prisma, service } = setup();
    prisma.bankReconciledEntry.findMany.mockResolvedValue([
      { journalLineId: 'journal-line-9' },
    ]);

    await expect(
      service.reconciledJournalLineIds(actor.tenantId, dto.cashAccountId),
    ).resolves.toEqual({ journalLineIds: ['journal-line-9'] });
  });

  it('returns not found for an unknown reconciliation', async () => {
    const { prisma, service } = setup();
    prisma.bankReconciliation.findFirst.mockResolvedValue(null);

    await expect(service.get(actor.tenantId, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
