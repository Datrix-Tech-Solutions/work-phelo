/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestUser } from '@work-phelo/types';
import { CashbookService } from './cashbook.service';
import { UpdateCashbookDraftDto } from './dto/draft-actions.dto';

describe('CashbookService draft receipts and payments', () => {
  const user = {
    id: 'user-1',
    tenantId: 'tenant-1',
    role: 'EMPLOYEE',
    permissions: [],
  } as unknown as RequestUser;

  const draft = (overrides: object = {}) => ({
    id: 'cb-1',
    tenantId: 'tenant-1',
    status: 'DRAFT',
    transactionType: 'RECEIPT',
    cashAccountId: 'cash-1',
    currency: 'GHS',
    sourceModule: 'MARKETING',
    receivableReceipt: null,
    payablePayment: null,
    lines: [],
    ...overrides,
  });

  const makePrisma = () => {
    const client: Record<string, any> = {
      cashbookTransaction: { findFirst: jest.fn(), updateMany: jest.fn() },
      cashbookTransactionLine: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue({}),
      },
      accountingCashAccount: { findFirst: jest.fn() },
      accountingAuditLog: { create: jest.fn() },
    };
    client.$transaction = jest.fn((fn: (tx: unknown) => unknown) =>
      Promise.resolve(fn(client)),
    );
    return client as {
      cashbookTransaction: { findFirst: jest.Mock; updateMany: jest.Mock };
      cashbookTransactionLine: {
        deleteMany: jest.Mock;
        createMany: jest.Mock;
        update: jest.Mock;
      };
      accountingCashAccount: { findFirst: jest.Mock };
      accountingAuditLog: { create: jest.Mock };
      $transaction: jest.Mock;
    };
  };

  let prisma: ReturnType<typeof makePrisma>;
  let notifier: { notify: jest.Mock };
  let service: CashbookService;

  beforeEach(() => {
    prisma = makePrisma();
    notifier = { notify: jest.fn().mockResolvedValue(undefined) };
    prisma.cashbookTransaction.findFirst.mockResolvedValue(draft());
    prisma.cashbookTransaction.updateMany.mockResolvedValue({ count: 1 });
    prisma.accountingAuditLog.create.mockResolvedValue({});
    service = new CashbookService(
      prisma as never,
      {} as never,
      notifier as never,
    );
    jest
      .spyOn(service as any, 'assertPostingOffsetAccount')
      .mockResolvedValue(undefined);
  });

  describe('updateDraftTransaction', () => {
    it('needs at least one field', async () => {
      await expect(
        service.updateDraftTransaction(user, 'cb-1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns not found for an entry that does not exist', async () => {
      prisma.cashbookTransaction.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDraftTransaction(user, 'cb-1', { reference: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each(['POSTED', 'REVERSED', 'REJECTED'])(
      'refuses to edit a %s entry',
      async (status) => {
        prisma.cashbookTransaction.findFirst.mockResolvedValue(
          draft({ status }),
        );

        await expect(
          service.updateDraftTransaction(user, 'cb-1', { reference: 'x' }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.cashbookTransaction.updateMany).not.toHaveBeenCalled();
      },
    );

    it('leaves entries that belong to a customer receipt or vendor payment to their own document', async () => {
      prisma.cashbookTransaction.findFirst.mockResolvedValue(
        draft({ receivableReceipt: { id: 'arr-1' } }),
      );
      await expect(
        service.updateDraftTransaction(user, 'cb-1', { reference: 'x' }),
      ).rejects.toBeInstanceOf(ConflictException);

      prisma.cashbookTransaction.findFirst.mockResolvedValue(
        draft({ transactionType: 'PAYMENT', payablePayment: { id: 'pay-1' } }),
      );
      await expect(
        service.updateDraftTransaction(user, 'cb-1', { reference: 'x' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it.each(['TRANSFER', 'CHARGE', 'ADJUSTMENT'])(
      'only edits direct receipts and payments, not a %s',
      async (transactionType) => {
        prisma.cashbookTransaction.findFirst.mockResolvedValue(
          draft({ transactionType }),
        );

        await expect(
          service.updateDraftTransaction(user, 'cb-1', { reference: 'x' }),
        ).rejects.toBeInstanceOf(ConflictException);
      },
    );

    it('changes the completing fields, only while the entry is still a draft', async () => {
      await service.updateDraftTransaction(user, 'cb-1', {
        transactionDate: '2026-10-05',
        settlementMethod: 'BANK_TRANSFER' as never,
        offsetGlAccountId: 'acct-2',
        reference: ' CHQ-9 ',
        description: 'Deposit received',
      });

      expect(prisma.cashbookTransaction.updateMany).toHaveBeenCalledWith({
        where: { id: 'cb-1', tenantId: 'tenant-1', status: 'DRAFT' },
        data: {
          updatedByUserId: 'user-1',
          transactionDate: new Date('2026-10-05'),
          settlementMethod: 'BANK_TRANSFER',
          offsetGlAccountId: 'acct-2',
          reference: 'CHQ-9',
          description: 'Deposit received',
        },
      });
      expect(prisma.accountingAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'CASHBOOK_TRANSACTION_DRAFT_UPDATED',
          entityId: 'cb-1',
        }),
      });
    });

    it('never touches the amount, quantity or unit price', async () => {
      await service.updateDraftTransaction(user, 'cb-1', { reference: 'x' });

      const data = prisma.cashbookTransaction.updateMany.mock.calls[0][0].data;
      for (const locked of [
        'amount',
        'quantity',
        'unitPrice',
        'direction',
        'transactionType',
      ]) {
        expect(data).not.toHaveProperty(locked);
      }
    });

    describe('lines', () => {
      const twoLines = [
        { glAccountId: 'acct-rent', amount: 2000 },
        { glAccountId: 'acct-insurance', amount: 70000, description: 'Policy' },
      ];

      beforeEach(() => {
        prisma.accountingCashAccount.findFirst.mockResolvedValue({
          glAccountId: 'cash-gl',
        });
      });

      it('replaces every line and sets the amount to their sum', async () => {
        await service.updateDraftTransaction(user, 'cb-1', { lines: twoLines });

        const data =
          prisma.cashbookTransaction.updateMany.mock.calls[0][0].data;
        expect(Number(data.amount.toString())).toBe(72000);
        expect(data.offsetGlAccountId).toBe('acct-rent');
        expect(data.quantity).toBeNull();
        expect(prisma.cashbookTransactionLine.deleteMany).toHaveBeenCalled();
        const created =
          prisma.cashbookTransactionLine.createMany.mock.calls[0][0].data;
        expect(created).toHaveLength(2);
        expect(created[1]).toMatchObject({
          tenantId: 'tenant-1',
          transactionId: 'cb-1',
          sequence: 2,
          glAccountId: 'acct-insurance',
          description: 'Policy',
        });
      });

      it('refuses lines combined with a single offset account', async () => {
        await expect(
          service.updateDraftTransaction(user, 'cb-1', {
            lines: twoLines,
            offsetGlAccountId: 'acct-2',
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it("refuses a line on the entry's own cash account", async () => {
        await expect(
          service.updateDraftTransaction(user, 'cb-1', {
            lines: [{ glAccountId: 'cash-gl', amount: 10 }],
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.cashbookTransaction.updateMany).not.toHaveBeenCalled();
      });

      it('refuses to change one account on an entry with several lines', async () => {
        prisma.cashbookTransaction.findFirst.mockResolvedValue(
          draft({ lines: [{ id: 'l1' }, { id: 'l2' }] }),
        );
        await expect(
          service.updateDraftTransaction(user, 'cb-1', {
            offsetGlAccountId: 'acct-2',
          }),
        ).rejects.toThrow('edit its lines');
      });

      it('keeps a single line in step with a changed account', async () => {
        prisma.cashbookTransaction.findFirst.mockResolvedValue(
          draft({ lines: [{ id: 'l1' }] }),
        );
        await service.updateDraftTransaction(user, 'cb-1', {
          offsetGlAccountId: 'acct-2',
        });
        expect(prisma.cashbookTransactionLine.update).toHaveBeenCalledWith({
          where: { id_tenantId: { id: 'l1', tenantId: 'tenant-1' } },
          data: { glAccountId: 'acct-2' },
        });
      });
    });

    it('rejects an attempt to send the locked fields at all', async () => {
      const dto = plainToInstance(UpdateCashbookDraftDto, {
        amount: 5,
        quantity: 2,
        unitPrice: 2.5,
        offsetSubledgerAccountId: 'someone-else',
      });

      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      expect(errors.map((e) => e.property).sort()).toEqual([
        'amount',
        'offsetSubledgerAccountId',
        'quantity',
        'unitPrice',
      ]);
    });

    describe('changing the cash account', () => {
      it('uses an active account in the entry’s currency', async () => {
        prisma.accountingCashAccount.findFirst.mockResolvedValue({
          id: 'cash-2',
          currency: 'GHS',
          isActive: true,
        });

        await service.updateDraftTransaction(user, 'cb-1', {
          cashAccountId: 'cash-2',
        });

        expect(
          prisma.cashbookTransaction.updateMany.mock.calls[0][0].data
            .cashAccountId,
        ).toBe('cash-2');
      });

      it('refuses an account in another currency', async () => {
        prisma.accountingCashAccount.findFirst.mockResolvedValue({
          id: 'cash-2',
          currency: 'USD',
          isActive: true,
        });

        await expect(
          service.updateDraftTransaction(user, 'cb-1', {
            cashAccountId: 'cash-2',
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.cashbookTransaction.updateMany).not.toHaveBeenCalled();
      });

      it('refuses an inactive account', async () => {
        prisma.accountingCashAccount.findFirst.mockResolvedValue({
          id: 'cash-2',
          currency: 'GHS',
          isActive: false,
        });

        await expect(
          service.updateDraftTransaction(user, 'cb-1', {
            cashAccountId: 'cash-2',
          }),
        ).rejects.toBeInstanceOf(ConflictException);
      });

      it('does not look the account up again when it is unchanged', async () => {
        await service.updateDraftTransaction(user, 'cb-1', {
          cashAccountId: 'cash-1',
        });

        expect(prisma.accountingCashAccount.findFirst).not.toHaveBeenCalled();
      });
    });

    it('conflicts if someone else changed the entry first', async () => {
      prisma.cashbookTransaction.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateDraftTransaction(user, 'cb-1', { reference: 'x' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('rejectTransaction', () => {
    it('turns the draft down with a reason, keeps the record, and tells the module', async () => {
      await service.rejectTransaction(user, 'cb-1', { reason: 'Not ours' });

      expect(prisma.cashbookTransaction.updateMany).toHaveBeenCalledWith({
        where: { id: 'cb-1', tenantId: 'tenant-1', status: 'DRAFT' },
        data: {
          status: 'REJECTED',
          rejectedAt: expect.any(Date),
          rejectedByUserId: 'user-1',
          rejectionReason: 'Not ours',
          updatedByUserId: 'user-1',
        },
      });
      expect(notifier.notify).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        sourceModule: 'MARKETING',
        transactionId: 'cb-1',
        event: 'REJECTED',
      });
    });

    it('only rejects a draft direct entry', async () => {
      prisma.cashbookTransaction.findFirst.mockResolvedValue(
        draft({ status: 'POSTED' }),
      );

      await expect(
        service.rejectTransaction(user, 'cb-1', { reason: 'x' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(notifier.notify).not.toHaveBeenCalled();
    });

    it('leaves a customer receipt’s entry to its receipt', async () => {
      prisma.cashbookTransaction.findFirst.mockResolvedValue(
        draft({ receivableReceipt: { id: 'arr-1' } }),
      );

      await expect(
        service.rejectTransaction(user, 'cb-1', { reason: 'x' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('telling the module what happened', () => {
    it('reports a posted entry once it is committed', async () => {
      jest
        .spyOn(service, 'postTransactionInTransaction')
        .mockResolvedValue({ id: 'cb-1' } as never);

      await service.postTransaction(user, 'cb-1');

      expect(notifier.notify).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        sourceModule: 'MARKETING',
        transactionId: 'cb-1',
        event: 'POSTED',
      });
    });

    it('reports a reversed entry against the original id', async () => {
      jest
        .spyOn(service, 'reverseTransactionInTransaction')
        .mockResolvedValue({ id: 'reversal-1' } as never);

      await service.reverseTransaction(user, 'cb-1', { reason: 'x' } as never);

      expect(notifier.notify).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        sourceModule: 'MARKETING',
        transactionId: 'cb-1',
        event: 'REVERSED',
      });
    });

    it('does not report a post that failed', async () => {
      jest
        .spyOn(service, 'postTransactionInTransaction')
        .mockRejectedValue(new ConflictException('not a draft'));

      await expect(
        service.postTransaction(user, 'cb-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(notifier.notify).not.toHaveBeenCalled();
    });
  });
});
