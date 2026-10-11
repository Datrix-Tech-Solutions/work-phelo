/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
import { NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { ArchiveService } from './archive.service';

const actor = {
  id: 'user-1',
  tenantId: 'tenant-1',
  role: 'EMPLOYEE',
  permissions: [],
} as unknown as RequestUser;

describe('deleting archived entries', () => {
  function setup(count = 1) {
    const updateMany = jest.fn().mockResolvedValue({ count });
    const prisma: Record<string, any> = {
      journalEntry: { updateMany },
      cashbookTransaction: { updateMany },
      accountingReceivableDocument: { updateMany },
      accountingReceivableReceipt: { updateMany },
      accountingPayableDocument: { updateMany },
      accountingPayablePayment: { updateMany },
      accountingAuditLog: { create: jest.fn() },
    };
    return { updateMany, prisma, service: new ArchiveService(prisma as never) };
  }

  it('hides a voided entry from the archive without touching its row', async () => {
    const { updateMany, prisma, service } = setup();
    await service.deleteArchived(actor, 'INVOICE', 'doc-1');
    expect(updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'doc-1',
        tenantId: 'tenant-1',
        documentType: 'INVOICE',
        status: 'VOIDED',
        archiveDeletedAt: null,
      }),
      data: expect.objectContaining({
        archiveDeletedAt: expect.any(Date),
        archiveDeletedByUserId: 'user-1',
      }),
    });
    expect(prisma.accountingAuditLog.create).toHaveBeenCalled();
  });

  it('keeps bills and debit notes apart', async () => {
    const { updateMany, service } = setup();
    await service.deleteArchived(actor, 'DEBIT_NOTE', 'doc-1');
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ documentType: 'CREDIT_NOTE' }),
      }),
    );
  });

  it('refuses anything that is not a voided, undeleted entry', async () => {
    const { prisma, service } = setup(0);
    await expect(
      service.deleteArchived(actor, 'PAYMENT', 'pay-1'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.accountingAuditLog.create).not.toHaveBeenCalled();
  });

  it('deletes several and skips what is no longer archived', async () => {
    const { updateMany, service } = setup();
    updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    const result = await service.deleteArchivedMany(actor, [
      { kind: 'INVOICE', id: 'a' },
      { kind: 'BILL', id: 'b' },
      { kind: 'JOURNAL', id: 'c' },
    ]);
    expect(result).toEqual({ deleted: 2, skipped: 1 });
  });
});
