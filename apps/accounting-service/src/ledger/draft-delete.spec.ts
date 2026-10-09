/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  AccountingReceivableDocumentType,
  AccountingReceivableStatus,
  CashbookTransactionStatus,
  CashbookTransactionType,
  JournalStatus,
} from '../../prisma/generated/client';
import { CashbookService } from './cashbook.service';
import { JournalsService } from './journals.service';
import { ReceivablesService } from './receivables.service';

const actor = {
  id: 'user-1',
  tenantId: 'tenant-1',
  role: 'EMPLOYEE',
  permissions: [],
} as unknown as RequestUser;

describe('deleting drafts', () => {
  describe('cashbook', () => {
    const draft = (overrides: Record<string, unknown> = {}) => ({
      id: 'cb-1',
      status: CashbookTransactionStatus.DRAFT,
      transactionType: CashbookTransactionType.PAYMENT,
      transactionNumber: 'PMNT26-00001',
      sourceModule: null,
      receivableReceipt: null,
      payablePayment: null,
      ...overrides,
    });
    function setup(row: unknown) {
      const prisma: Record<string, any> = {
        cashbookTransaction: {
          findFirst: jest.fn().mockResolvedValue(row),
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        accountingAuditLog: { create: jest.fn() },
      };
      return {
        prisma,
        service: new CashbookService(prisma as never, {} as never),
      };
    }

    it('deletes a draft entered on the transactions page', async () => {
      const { prisma, service } = setup(draft());
      await expect(
        service.deleteDraftTransaction(actor, 'cb-1'),
      ).resolves.toEqual({
        id: 'cb-1',
        deleted: true,
      });
      expect(prisma.cashbookTransaction.deleteMany).toHaveBeenCalledWith({
        where: { id: 'cb-1', tenantId: 'tenant-1', status: 'DRAFT' },
      });
      expect(prisma.accountingAuditLog.create).toHaveBeenCalled();
    });

    it('deletes a draft transfer', async () => {
      const { service } = setup(
        draft({ transactionType: CashbookTransactionType.TRANSFER }),
      );
      await expect(
        service.deleteDraftTransaction(actor, 'cb-1'),
      ).resolves.toMatchObject({ deleted: true });
    });

    it('keeps a posted entry', async () => {
      const { prisma, service } = setup(
        draft({ status: CashbookTransactionStatus.POSTED }),
      );
      await expect(
        service.deleteDraftTransaction(actor, 'cb-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.cashbookTransaction.deleteMany).not.toHaveBeenCalled();
    });

    it('leaves a draft raised by another module to be rejected instead', async () => {
      const { service } = setup(draft({ sourceModule: 'HR' }));
      await expect(
        service.deleteDraftTransaction(actor, 'cb-1'),
      ).rejects.toThrow('reject it instead');
    });

    it('says so when the entry does not exist', async () => {
      const { service } = setup(null);
      await expect(
        service.deleteDraftTransaction(actor, 'cb-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('journals', () => {
    function setup(row: unknown) {
      const tx: Record<string, any> = {
        $executeRaw: jest.fn(),
        journalEntry: {
          findFirst: jest.fn().mockResolvedValue(row),
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        accountingAuditLog: { create: jest.fn() },
      };
      const prisma = {
        $transaction: jest.fn((fn: (t: unknown) => unknown) =>
          Promise.resolve(fn(tx)),
        ),
      };
      return {
        tx,
        service: new JournalsService(prisma as never, {} as never),
      };
    }

    it('deletes a draft journal', async () => {
      const { tx, service } = setup({
        id: 'j-1',
        status: JournalStatus.DRAFT,
        journalNumber: 'STN-001',
        sourceRecordId: null,
      });
      await expect(service.deleteDraft(actor, 'j-1')).resolves.toEqual({
        id: 'j-1',
        deleted: true,
      });
      expect(tx.journalEntry.deleteMany).toHaveBeenCalled();
    });

    it('keeps a posted journal', async () => {
      const { tx, service } = setup({
        id: 'j-1',
        status: JournalStatus.POSTED,
        journalNumber: 'STN-001',
        sourceRecordId: null,
      });
      await expect(service.deleteDraft(actor, 'j-1')).rejects.toThrow(
        'Only draft journals',
      );
      expect(tx.journalEntry.deleteMany).not.toHaveBeenCalled();
    });

    it("keeps a journal that belongs to another record's posting", async () => {
      const { service } = setup({
        id: 'j-1',
        status: JournalStatus.DRAFT,
        journalNumber: 'STN-001',
        sourceRecordId: 'rec-1',
      });
      await expect(service.deleteDraft(actor, 'j-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('invoices', () => {
    function setup(row: unknown) {
      const prisma: Record<string, any> = {
        accountingReceivableDocument: {
          findFirst: jest.fn().mockResolvedValue(row),
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        accountingAuditLog: { create: jest.fn() },
      };
      return {
        prisma,
        service: new ReceivablesService(
          prisma as never,
          {} as never,
          {} as never,
        ),
      };
    }
    const doc = (overrides: Record<string, unknown> = {}) => ({
      id: 'inv-1',
      status: AccountingReceivableStatus.DRAFT,
      sourceModule: null,
      documentNumber: 'INV26-00001',
      ...overrides,
    });

    it('deletes a draft invoice', async () => {
      const { prisma, service } = setup(doc());
      await service.deleteDraftInvoice(actor, 'inv-1');
      expect(
        prisma.accountingReceivableDocument.findFirst,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            documentType: AccountingReceivableDocumentType.INVOICE,
          }),
        }),
      );
      expect(prisma.accountingReceivableDocument.deleteMany).toHaveBeenCalled();
    });

    it('keeps a posted invoice and one raised by another module', async () => {
      await expect(
        setup(
          doc({ status: AccountingReceivableStatus.POSTED }),
        ).service.deleteDraftInvoice(actor, 'inv-1'),
      ).rejects.toThrow('Only draft invoices');
      await expect(
        setup(doc({ sourceModule: 'MARKETING' })).service.deleteDraftInvoice(
          actor,
          'inv-1',
        ),
      ).rejects.toThrow('reject it instead');
    });
  });
});
