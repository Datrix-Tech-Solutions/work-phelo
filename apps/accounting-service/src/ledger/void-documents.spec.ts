/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */
import { RequestUser } from '@work-phelo/types';
import {
  AccountingReceivableDocumentType,
  AccountingReceivableStatus,
  CashbookTransactionStatus,
  CashbookTransactionType,
  Prisma,
} from '../../prisma/generated/client';
import { CashbookService } from './cashbook.service';
import { ReceivablesService } from './receivables.service';

const actor = {
  id: 'user-1',
  tenantId: 'tenant-1',
  role: 'EMPLOYEE',
  permissions: [],
} as unknown as RequestUser;

describe('voiding invoices, credit notes and receipts', () => {
  function setup(documentOverrides: Record<string, unknown> = {}) {
    const document = {
      id: 'doc-1',
      tenantId: 'tenant-1',
      documentNumber: 'INV26-00001',
      documentType: AccountingReceivableDocumentType.INVOICE,
      status: AccountingReceivableStatus.POSTED,
      sourceModule: null,
      postedJournalEntryId: 'j-1',
      totalAmount: new Prisma.Decimal(75000),
      ...documentOverrides,
    };
    const tx: Record<string, any> = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      accountingReceivableDocument: {
        findFirst: jest.fn().mockResolvedValue(document),
        findUniqueOrThrow: jest.fn().mockResolvedValue(document),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      accountingReceivableAllocation: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn(),
      },
      accountingAuditLog: { create: jest.fn() },
    };
    const journals = {
      voidSystemJournalInTransaction: jest.fn(),
    };
    const prisma = {
      $transaction: (fn: (t: unknown) => unknown) => fn(tx),
      accountingReceivableDocument: {
        findFirst: jest.fn().mockResolvedValue(document),
      },
    };
    return {
      tx,
      journals,
      service: new ReceivablesService(
        prisma as never,
        {} as never,
        journals as never,
      ),
    };
  }

  it('voids an invoice with nothing against it and takes its journal out', async () => {
    const { tx, journals, service } = setup();
    await service.voidInvoice(actor, 'doc-1', { reason: 'Wrong customer' });
    expect(journals.voidSystemJournalInTransaction).toHaveBeenCalledWith(
      tx,
      actor,
      'j-1',
      'Wrong customer',
    );
    expect(tx.accountingReceivableDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AccountingReceivableStatus.VOIDED,
          voidReason: 'Wrong customer',
        }),
      }),
    );
  });

  it('makes the payments go first', async () => {
    const { tx, journals, service } = setup();
    tx.accountingReceivableAllocation.count.mockResolvedValue(1);
    await expect(
      service.voidInvoice(actor, 'doc-1', { reason: 'x' }),
    ).rejects.toThrow(/Void those first/);
    expect(journals.voidSystemJournalInTransaction).not.toHaveBeenCalled();
  });

  it('makes live credit notes go first too', async () => {
    const { tx, service } = setup();
    tx.accountingReceivableDocument.count.mockResolvedValue(1);
    await expect(
      service.voidInvoice(actor, 'doc-1', { reason: 'x' }),
    ).rejects.toThrow(/Void those first/);
  });

  it('lets a credit note go and frees what it was applied to', async () => {
    const { tx, service } = setup({
      documentType: AccountingReceivableDocumentType.CREDIT_NOTE,
    });
    await service.voidCreditNote(actor, 'doc-1', { reason: 'Duplicate' });
    expect(tx.accountingReceivableAllocation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          creditNoteId: 'doc-1',
          reversedAt: null,
        }),
      }),
    );
  });

  it('leaves another module’s documents to that module', async () => {
    const { journals, service } = setup({ sourceModule: 'PAYROLL' });
    await expect(
      service.voidInvoice(actor, 'doc-1', { reason: 'x' }),
    ).rejects.toThrow(/another module/);
    expect(journals.voidSystemJournalInTransaction).not.toHaveBeenCalled();
  });

  it('refuses a reversed or draft invoice', async () => {
    const reversed = setup({ status: AccountingReceivableStatus.REVERSED });
    await expect(
      reversed.service.voidInvoice(actor, 'doc-1', { reason: 'x' }),
    ).rejects.toThrow(/reversed/);
    const draft = setup({ status: AccountingReceivableStatus.DRAFT });
    await expect(
      draft.service.voidInvoice(actor, 'doc-1', { reason: 'x' }),
    ).rejects.toThrow(/Only posted/);
  });

  it('only restores a voided invoice', async () => {
    const { service } = setup();
    await expect(service.restoreInvoice(actor, 'doc-1', {})).rejects.toThrow(
      /Only voided invoices/,
    );
  });
});

describe('voiding cashbook entries', () => {
  function setup(overrides: Record<string, unknown> = {}) {
    const transaction = {
      id: 'cb-1',
      tenantId: 'tenant-1',
      status: CashbookTransactionStatus.POSTED,
      transactionType: CashbookTransactionType.RECEIPT,
      transactionNumber: 'RCPT26-00001',
      sourceModule: null,
      postedJournalEntryId: 'j-1',
      reversalOfTransactionId: null,
      receivableReceipt: null,
      payablePayment: null,
      bankStatementMatches: [],
      sourceLedgerAllocations: [],
      lines: [],
      ...overrides,
    };
    const tx: Record<string, any> = {
      $executeRaw: jest.fn(),
      cashbookTransaction: {
        findFirst: jest.fn().mockResolvedValue(transaction),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(transaction),
      },
      accountingAuditLog: { create: jest.fn() },
    };
    const journals = {
      voidSystemJournalInTransaction: jest.fn(),
      setReversedInTransaction: jest.fn(),
    };
    const prisma = {
      $transaction: (fn: (t: unknown) => unknown) => fn(tx),
      cashbookTransaction: {
        findFirst: jest.fn().mockResolvedValue(transaction),
      },
    };
    return {
      tx,
      journals,
      service: new CashbookService(prisma as never, journals as never),
    };
  }

  it('voids a posted receipt together with its journal', async () => {
    const { tx, journals, service } = setup();
    await service.voidPostedTransaction(actor, 'cb-1', { reason: 'Typo' });
    expect(journals.voidSystemJournalInTransaction).toHaveBeenCalled();
    expect(tx.cashbookTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CashbookTransactionStatus.VOIDED,
          voidReason: 'Typo',
        }),
      }),
    );
  });

  it('makes the reversal go first', async () => {
    const { journals, service } = setup({
      status: CashbookTransactionStatus.REVERSED,
    });
    await expect(
      service.voidPostedTransaction(actor, 'cb-1', { reason: 'x' }),
    ).rejects.toThrow(/Void the reversal first/);
    expect(journals.voidSystemJournalInTransaction).not.toHaveBeenCalled();
  });

  it('puts the original back when its reversal is voided', async () => {
    const { tx, journals, service } = setup({
      reversalOfTransactionId: 'cb-0',
    });
    tx.cashbookTransaction.findFirst
      .mockResolvedValueOnce({
        id: 'cb-1',
        status: CashbookTransactionStatus.POSTED,
        sourceModule: null,
        postedJournalEntryId: 'j-1',
        reversalOfTransactionId: 'cb-0',
        receivableReceipt: null,
        payablePayment: null,
        bankStatementMatches: [],
        sourceLedgerAllocations: [],
        lines: [],
      })
      .mockResolvedValueOnce({ postedJournalEntryId: 'j-0' });
    await service.voidPostedTransaction(actor, 'cb-1', { reason: 'Mistake' });
    expect(journals.setReversedInTransaction).toHaveBeenCalledWith(
      tx,
      actor,
      'j-0',
      false,
    );
    expect(tx.cashbookTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'cb-0',
          status: CashbookTransactionStatus.REVERSED,
        }),
        data: expect.objectContaining({
          status: CashbookTransactionStatus.POSTED,
        }),
      }),
    );
  });

  it('holds entries matched to a bank statement', async () => {
    const { journals, service } = setup({
      bankStatementMatches: [{ id: 'm-1' }],
    });
    await expect(
      service.voidPostedTransaction(actor, 'cb-1', { reason: 'x' }),
    ).rejects.toThrow(/matched to a bank statement/);
    expect(journals.voidSystemJournalInTransaction).not.toHaveBeenCalled();
  });

  it('sends invoice and bill payments to their document', async () => {
    const { service } = setup({ receivableReceipt: { id: 'r-1' } });
    await expect(
      service.voidPostedTransaction(actor, 'cb-1', { reason: 'x' }),
    ).rejects.toThrow(/Change it from that document/);
  });

  it('leaves another module’s entries to that module', async () => {
    const { service } = setup({ sourceModule: 'PAYROLL' });
    await expect(
      service.voidPostedTransaction(actor, 'cb-1', { reason: 'x' }),
    ).rejects.toThrow(/another module/);
  });
});
