/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */
import { ConflictException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  FiscalPeriodStatus,
  JournalEntryType,
  JournalStatus,
  Prisma,
} from '../../prisma/generated/client';
import { JournalsService } from './journals.service';

const actor = {
  id: 'user-1',
  tenantId: 'tenant-1',
  role: 'EMPLOYEE',
  permissions: [],
} as unknown as RequestUser;

const line = (id: string, debit: number, credit: number) => ({
  id,
  glAccountId: `gl-${id}`,
  subledgerAccountId: null,
  costCentreId: null,
  description: null,
  lineNumber: 1,
  transactionDebit: new Prisma.Decimal(debit),
  transactionCredit: new Prisma.Decimal(credit),
  baseDebit: new Prisma.Decimal(debit),
  baseCredit: new Prisma.Decimal(credit),
});

const journal = (overrides: Record<string, unknown> = {}) => ({
  id: 'j-1',
  tenantId: 'tenant-1',
  journalNumber: 'JE-STN2610-0000',
  entryType: JournalEntryType.STANDARD,
  adjustmentCategory: null,
  status: JournalStatus.POSTED,
  transactionDate: new Date('2026-10-05T00:00:00.000Z'),
  fiscalPeriodId: 'period-1',
  transactionCurrency: 'GHS',
  exchangeRate: new Prisma.Decimal(1),
  reference: null,
  description: 'Rent',
  sourceModule: null,
  sourceRecordId: null,
  reversalOfJournalId: null,
  voidedReversalOfJournalId: null,
  reversalJournal: null,
  lines: [line('a', 100, 0), line('b', 0, 100)],
  receivablePostedDocument: null,
  receivableReversalDocument: null,
  payablePostedDocument: null,
  payableReversalDocument: null,
  cashbookPostedTransaction: null,
  cashbookReversalTransaction: null,
  sourceEvent: null,
  ...overrides,
});

function setup(
  row: Record<string, unknown> | null,
  periodStatus: FiscalPeriodStatus = FiscalPeriodStatus.OPEN,
) {
  const tx: Record<string, any> = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    journalEntry: {
      findFirst: jest.fn().mockResolvedValue(row),
      findUniqueOrThrow: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue(row),
    },
    fiscalPeriod: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'period-1',
        name: 'October 2026',
        status: periodStatus,
      }),
    },
    accountingAuditLog: { create: jest.fn() },
  };
  const prisma = { $transaction: (fn: (t: unknown) => unknown) => fn(tx) };
  return { tx, service: new JournalsService(prisma as never, {} as never) };
}

describe('voiding and editing posted journals', () => {
  it('voids a posted journal in an open period and records why', async () => {
    const { tx, service } = setup(journal());
    await service.voidPosted(actor, 'j-1', { reason: 'Wrong account' });
    expect(tx.journalEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: JournalStatus.VOIDED,
          voidReason: 'Wrong account',
          voidedByUserId: 'user-1',
        }),
      }),
    );
    expect(tx.accountingAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'JOURNAL_VOIDED' }),
    });
  });

  it('refuses once the period is no longer open', async () => {
    const { tx, service } = setup(journal(), FiscalPeriodStatus.CLOSED);
    await expect(
      service.voidPosted(actor, 'j-1', { reason: 'x' }),
    ).rejects.toThrow(/closed, so this entry can no longer be voided/);
    expect(tx.journalEntry.update).not.toHaveBeenCalled();
  });

  it('refuses to edit in a closed period', async () => {
    const { tx, service } = setup(journal(), FiscalPeriodStatus.SOFT_CLOSED);
    await expect(
      service.editPosted(actor, 'j-1', { description: 'New' }),
    ).rejects.toThrow(/can no longer be edited/);
    expect(tx.journalEntry.update).not.toHaveBeenCalled();
  });

  it('makes the reversal go first', async () => {
    const { service } = setup(
      journal({
        reversalJournal: {
          id: 'j-2',
          journalNumber: 'JE-RVS2610-0000',
          transactionDate: new Date(),
          status: JournalStatus.POSTED,
        },
      }),
    );
    await expect(
      service.voidPosted(actor, 'j-1', { reason: 'x' }),
    ).rejects.toThrow(/Void the reversal first/);
    await expect(
      service.editPosted(actor, 'j-1', { description: 'x' }),
    ).rejects.toThrow(/Void the reversal first/);
  });

  it('frees the original when a reversal is voided, keeping the link for a restore', async () => {
    const { tx, service } = setup(
      journal({ reversalOfJournalId: 'j-0', entryType: 'REVERSING' }),
    );
    await service.voidPosted(actor, 'j-1', { reason: 'Reversed by mistake' });
    expect(tx.journalEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reversalOfJournalId: null,
          voidedReversalOfJournalId: 'j-0',
        }),
      }),
    );
  });

  it('will not touch a journal another record posted', async () => {
    const { tx, service } = setup(
      journal({ sourceModule: 'ACCOUNTING', sourceRecordId: 'cb-1' }),
    );
    await expect(
      service.voidPosted(actor, 'j-1', { reason: 'x' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.journalEntry.update).not.toHaveBeenCalled();
  });

  it('will not void a draft or an already voided journal', async () => {
    const draft = setup(journal({ status: JournalStatus.DRAFT }));
    await expect(
      draft.service.voidPosted(actor, 'j-1', { reason: 'x' }),
    ).rejects.toThrow(/Only posted journals/);
    const voided = setup(journal({ status: JournalStatus.VOIDED }));
    await expect(
      voided.service.voidPosted(actor, 'j-1', { reason: 'x' }),
    ).rejects.toThrow(/Only posted journals/);
  });
});

describe('restoring voided journals', () => {
  it('only restores voided journals', async () => {
    const { service } = setup(journal());
    await expect(service.restoreVoided(actor, 'j-1', {})).rejects.toThrow(
      /Only voided journals/,
    );
  });

  it('refuses in a closed period', async () => {
    const { service } = setup(
      journal({ status: JournalStatus.VOIDED }),
      FiscalPeriodStatus.CLOSED,
    );
    await expect(service.restoreVoided(actor, 'j-1', {})).rejects.toThrow(
      /can no longer be restored/,
    );
  });

  it('restores a voided reversal only while its original is posted', async () => {
    const { tx, service } = setup(
      journal({
        status: JournalStatus.VOIDED,
        voidedReversalOfJournalId: 'j-0',
      }),
    );
    tx.journalEntry.findFirst
      .mockResolvedValueOnce(
        journal({
          status: JournalStatus.VOIDED,
          voidedReversalOfJournalId: 'j-0',
        }),
      )
      .mockResolvedValueOnce({
        status: JournalStatus.VOIDED,
        journalNumber: 'JE-STN2610-0000',
        reversalJournal: null,
      });
    await expect(service.restoreVoided(actor, 'j-1', {})).rejects.toThrow(
      /Restore the original journal before its reversal/,
    );
  });
});
