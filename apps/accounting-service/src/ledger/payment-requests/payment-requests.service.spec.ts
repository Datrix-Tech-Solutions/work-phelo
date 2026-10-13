/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../../prisma/generated/client';
import { PaymentRequestsService } from './payment-requests.service';

const D = (value: string | number) => new Prisma.Decimal(value);

describe('PaymentRequestsService', () => {
  const user = { id: 'acct-1', tenantId: 'tenant-1' } as unknown as RequestUser;
  const uniqueError = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

  const invoice = (overrides: object = {}) => ({
    id: 'inv-1',
    tenantId: 'tenant-1',
    customerId: 'entity-1',
    documentType: 'INVOICE',
    status: 'POSTED',
    currency: 'GHS',
    documentNumber: 'INV26-00012',
    ...overrides,
  });
  const request = (overrides: object = {}) => ({
    id: 'req-1',
    tenantId: 'tenant-1',
    sourceModule: 'MARKETING',
    idempotencyKey: 'k1',
    invoiceId: 'inv-1',
    customerId: 'entity-1',
    amount: D('5000'),
    currency: 'GHS',
    paymentDate: new Date('2026-09-12'),
    reference: 'TT-993',
    note: null,
    status: 'PENDING',
    requestedByUserId: 'user-1',
    requestedByName: 'Ada',
    processingStartedAt: null,
    receiptId: null,
    completedAt: null,
    completedByUserId: null,
    rejectedAt: null,
    rejectedByUserId: null,
    rejectionReason: null,
    cancelledAt: null,
    cancelledByUserId: null,
    createdAt: new Date('2026-09-12T10:00:00.000Z'),
    updatedAt: new Date('2026-09-12T10:00:00.000Z'),
    ...overrides,
  });

  const createDto = (overrides: object = {}) =>
    ({
      tenantId: 'tenant-1',
      sourceModule: 'MARKETING',
      idempotencyKey: 'k1',
      externalRef: 'client-1',
      invoiceId: 'inv-1',
      amount: 5000,
      paymentDate: '2026-09-12',
      reference: 'TT-993',
      requestedByName: 'Ada',
      ...overrides,
    }) as never;

  const makePrisma = () => {
    const prisma = {
      accountingReceivableDocument: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      accountingReceivableReceipt: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      accountingReceivableAllocation: { findFirst: jest.fn() },
      subledgerAccount: { findFirst: jest.fn(), findMany: jest.fn() },
      accountingPaymentRequest: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
      accountingAuditLog: { create: jest.fn() },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((arg: unknown) =>
      Array.isArray(arg)
        ? Promise.all(arg)
        : (arg as (tx: unknown) => unknown)(prisma),
    );
    return prisma;
  };

  let prisma: ReturnType<typeof makePrisma>;
  let receivables: Record<
    'invoiceBalance' | 'createReceipt' | 'postReceipt' | 'allocateReceipt',
    jest.Mock
  >;
  let service: PaymentRequestsService;

  beforeEach(() => {
    prisma = makePrisma();
    receivables = {
      invoiceBalance: jest
        .fn()
        .mockResolvedValue({ outstandingAmount: '12000.00' }),
      createReceipt: jest.fn().mockResolvedValue({ id: 'rcpt-1' }),
      postReceipt: jest.fn().mockResolvedValue({}),
      allocateReceipt: jest.fn().mockResolvedValue({}),
    };
    prisma.accountingReceivableDocument.findFirst.mockResolvedValue(invoice());
    prisma.accountingReceivableDocument.findMany.mockResolvedValue([invoice()]);
    prisma.subledgerAccount.findFirst.mockResolvedValue({
      externalRef: 'MARKETING:client-1',
    });
    prisma.subledgerAccount.findMany.mockResolvedValue([
      { id: 'entity-1', name: 'Dell Computers', code: 'MKC-0001' },
    ]);
    prisma.accountingReceivableReceipt.findMany.mockResolvedValue([]);
    prisma.accountingPaymentRequest.findUnique.mockResolvedValue(null);
    prisma.accountingPaymentRequest.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });
    prisma.accountingPaymentRequest.create.mockImplementation(
      ({ data }: { data: object }) => Promise.resolve(request(data)),
    );
    prisma.accountingPaymentRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.accountingPaymentRequest.update.mockImplementation(
      ({ data }: { data: object }) => Promise.resolve(request(data)),
    );
    prisma.accountingAuditLog.create.mockResolvedValue({});
    service = new PaymentRequestsService(prisma as never, receivables as never);
  });

  describe('createFromSource', () => {
    it('refuses modules that are not registered', async () => {
      await expect(
        service.createFromSource(
          'user-1',
          createDto({ sourceModule: 'RECRUITMENT' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns the request already raised for the same key', async () => {
      prisma.accountingPaymentRequest.findUnique.mockResolvedValue(request());

      const result = await service.createFromSource('user-1', createDto());

      expect(result).toEqual({
        id: 'req-1',
        status: 'PENDING',
        amount: '5000.00',
      });
      expect(prisma.accountingPaymentRequest.create).not.toHaveBeenCalled();
    });

    it('does not find invoices that belong to another record', async () => {
      prisma.subledgerAccount.findFirst.mockResolvedValue({
        externalRef: 'MARKETING:someone-else',
      });

      await expect(
        service.createFromSource('user-1', createDto()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not find an invoice that does not exist', async () => {
      prisma.accountingReceivableDocument.findFirst.mockResolvedValue(null);

      await expect(
        service.createFromSource('user-1', createDto()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each(['DRAFT', 'REVERSED', 'REJECTED'])(
      'only takes requests for a posted invoice, not a %s one',
      async (status) => {
        prisma.accountingReceivableDocument.findFirst.mockResolvedValue(
          invoice({ status }),
        );

        await expect(
          service.createFromSource('user-1', createDto()),
        ).rejects.toBeInstanceOf(ConflictException);
      },
    );

    it('refuses a payment date in the future', async () => {
      const tomorrow = new Date(Date.now() + 86_400_000 * 2)
        .toISOString()
        .slice(0, 10);

      await expect(
        service.createFromSource(
          'user-1',
          createDto({ paymentDate: tomorrow }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a pending request and locks the invoice while it checks the balance', async () => {
      const result = await service.createFromSource('user-1', createDto());

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.accountingPaymentRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          sourceModule: 'MARKETING',
          idempotencyKey: 'k1',
          invoiceId: 'inv-1',
          customerId: 'entity-1',
          currency: 'GHS',
          reference: 'TT-993',
          requestedByUserId: 'user-1',
          requestedByName: 'Ada',
        }),
      });
      expect(result).toMatchObject({ id: 'req-1', status: 'PENDING' });
    });

    it('allows exactly what can still be claimed', async () => {
      await expect(
        service.createFromSource('user-1', createDto({ amount: 12000 })),
      ).resolves.toMatchObject({ status: 'PENDING' });
    });

    it('counts requests already waiting against what can be claimed', async () => {
      prisma.accountingPaymentRequest.aggregate.mockResolvedValue({
        _sum: { amount: D('9000') },
      });

      await expect(
        service.createFromSource('user-1', createDto({ amount: 3001 })),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createFromSource(
          'user-1',
          createDto({ amount: 3000, idempotencyKey: 'k2' }),
        ),
      ).resolves.toBeDefined();
    });

    it('says when nothing is left to claim', async () => {
      prisma.accountingPaymentRequest.aggregate.mockResolvedValue({
        _sum: { amount: D('12000') },
      });

      await expect(
        service.createFromSource('user-1', createDto()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('returns the winner when two identical submissions race', async () => {
      prisma.accountingPaymentRequest.create.mockRejectedValue(uniqueError());
      prisma.accountingPaymentRequest.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue(request());

      await expect(
        service.createFromSource('user-1', createDto()),
      ).resolves.toMatchObject({
        id: 'req-1',
      });
    });
  });

  describe('cancelFromSource', () => {
    const dto = {
      tenantId: 'tenant-1',
      sourceModule: 'MARKETING',
      externalRef: 'client-1',
    } as never;

    beforeEach(() => {
      prisma.accountingPaymentRequest.findFirst.mockResolvedValue(request());
    });

    it('withdraws a pending request, releasing its amount', async () => {
      const result = await service.cancelFromSource('user-1', 'req-1', dto);

      expect(prisma.accountingPaymentRequest.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'req-1',
          tenantId: 'tenant-1',
          status: 'PENDING',
          receiptId: null,
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: expect.any(Date),
          cancelledByUserId: 'user-1',
        },
      });
      expect(result).toEqual({ id: 'req-1', status: 'CANCELLED' });
    });

    it('does not find another record’s request', async () => {
      prisma.subledgerAccount.findFirst.mockResolvedValue({
        externalRef: 'MARKETING:someone-else',
      });

      await expect(
        service.cancelFromSource('user-1', 'req-1', dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not find a request that does not exist', async () => {
      prisma.accountingPaymentRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelFromSource('user-1', 'req-1', dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each(['COMPLETED', 'REJECTED', 'CANCELLED'])(
      'cannot cancel a %s request',
      async (status) => {
        prisma.accountingPaymentRequest.findFirst.mockResolvedValue(
          request({ status }),
        );

        await expect(
          service.cancelFromSource('user-1', 'req-1', dto),
        ).rejects.toBeInstanceOf(ConflictException);
      },
    );

    it('cannot cancel once the payment is being recorded', async () => {
      prisma.accountingPaymentRequest.findFirst.mockResolvedValue(
        request({ receiptId: 'rcpt-1' }),
      );

      await expect(
        service.cancelFromSource('user-1', 'req-1', dto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.accountingPaymentRequest.updateMany).not.toHaveBeenCalled();
    });

    it('conflicts if the accountant acted first', async () => {
      prisma.accountingPaymentRequest.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.cancelFromSource('user-1', 'req-1', dto),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('lists', () => {
    it('shows pending requests by default, newest first, with the entity and invoice', async () => {
      prisma.accountingPaymentRequest.count.mockResolvedValue(1);
      prisma.accountingPaymentRequest.findMany.mockResolvedValue([request()]);

      const result = await service.list('tenant-1');

      expect(prisma.accountingPaymentRequest.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', status: 'PENDING' },
      });
      expect(result.data[0]).toEqual({
        id: 'req-1',
        status: 'PENDING',
        sourceModule: 'MARKETING',
        invoiceId: 'inv-1',
        invoiceNumber: 'INV26-00012',
        entity: { id: 'entity-1', name: 'Dell Computers', code: 'MKC-0001' },
        amount: '5000.00',
        currency: 'GHS',
        paymentDate: '2026-09-12',
        reference: 'TT-993',
        note: null,
        requestedByUserId: 'user-1',
        requestedByName: 'Ada',
        receiptId: null,
        receiptNumber: null,
        rejectionReason: null,
        createdAt: '2026-09-12T10:00:00.000Z',
        completedAt: null,
        rejectedAt: null,
        cancelledAt: null,
      });
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('lists an invoice’s requests whatever their state', async () => {
      prisma.accountingPaymentRequest.findMany.mockResolvedValue([
        request({ status: 'COMPLETED', receiptId: 'rcpt-1' }),
        request({
          id: 'req-2',
          status: 'REJECTED',
          rejectionReason: 'Not received',
        }),
      ]);
      prisma.accountingReceivableReceipt.findMany.mockResolvedValue([
        { id: 'rcpt-1', receiptNumber: 'ARR26-00007' },
      ]);

      const result = await service.listForInvoice('tenant-1', 'inv-1');

      expect(prisma.accountingPaymentRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', invoiceId: 'inv-1' },
        }),
      );
      expect(
        result.items.map((i) => [i.status, i.receiptNumber, i.rejectionReason]),
      ).toEqual([
        ['COMPLETED', 'ARR26-00007', null],
        ['REJECTED', null, 'Not received'],
      ]);
    });

    it('counts only pending requests per invoice', async () => {
      prisma.accountingPaymentRequest.groupBy.mockResolvedValue([
        { invoiceId: 'inv-1', _count: { _all: 2 } },
      ]);

      const counts = await service.pendingCounts('tenant-1', [
        'inv-1',
        'inv-2',
      ]);

      expect(counts.get('inv-1')).toBe(2);
      expect(counts.get('inv-2')).toBeUndefined();
      expect(prisma.accountingPaymentRequest.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            invoiceId: { in: ['inv-1', 'inv-2'] },
            status: 'PENDING',
          },
        }),
      );
    });

    it('does not query for no invoices', async () => {
      await service.pendingCounts('tenant-1', []);

      expect(prisma.accountingPaymentRequest.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    beforeEach(() => {
      prisma.accountingPaymentRequest.findFirst.mockResolvedValue(request());
    });

    it('turns a pending request down with a reason, and records it', async () => {
      await service.reject(user, 'req-1', 'Not received');

      expect(prisma.accountingPaymentRequest.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'req-1',
          tenantId: 'tenant-1',
          status: 'PENDING',
          receiptId: null,
        },
        data: {
          status: 'REJECTED',
          rejectedAt: expect.any(Date),
          rejectedByUserId: 'acct-1',
          rejectionReason: 'Not received',
        },
      });
      expect(prisma.accountingAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'PAYMENT_REQUEST_REJECTED',
          entityId: 'req-1',
        }),
      });
    });

    it('only rejects a pending request', async () => {
      prisma.accountingPaymentRequest.findFirst.mockResolvedValue(
        request({ status: 'COMPLETED' }),
      );

      await expect(service.reject(user, 'req-1', 'x')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('will not reject one a receipt has already been made for', async () => {
      prisma.accountingPaymentRequest.findFirst.mockResolvedValue(
        request({ receiptId: 'rcpt-1' }),
      );

      await expect(service.reject(user, 'req-1', 'x')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.accountingPaymentRequest.updateMany).not.toHaveBeenCalled();
    });

    it('returns not found for another tenant’s request', async () => {
      prisma.accountingPaymentRequest.findFirst.mockResolvedValue(null);

      await expect(service.reject(user, 'req-1', 'x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('complete', () => {
    const dto = {
      cashAccountId: 'cash-1',
      settlementMethod: 'BANK_TRANSFER',
      receiptDate: '2026-10-13',
    } as never;

    beforeEach(() => {
      prisma.accountingPaymentRequest.findFirst.mockResolvedValue(request());
      prisma.accountingReceivableReceipt.findFirst.mockResolvedValue({
        status: 'DRAFT',
        receiptNumber: 'ARR26-00007',
      });
      prisma.accountingReceivableAllocation.findFirst.mockResolvedValue(null);
    });

    it('creates the receipt for the chosen bank, posts it, allocates it, then marks the request done', async () => {
      await service.complete(user, 'req-1', dto);

      expect(receivables.createReceipt).toHaveBeenCalledWith(user, {
        customerId: 'entity-1',
        invoiceId: 'inv-1',
        cashAccountId: 'cash-1',
        amount: 5000,
        currency: 'GHS',
        receiptDate: '2026-10-13',
        settlementMethod: 'BANK_TRANSFER',
        reference: 'TT-993',
        description: undefined,
        sourceModule: 'MARKETING',
        sourceRecordId: 'req-1',
      });
      expect(receivables.postReceipt).toHaveBeenCalledWith(user, 'rcpt-1');
      expect(receivables.allocateReceipt).toHaveBeenCalledWith(user, 'rcpt-1', {
        invoiceId: 'inv-1',
        amount: 5000,
      });
      expect(prisma.accountingPaymentRequest.update).toHaveBeenLastCalledWith({
        where: { id: 'req-1' },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date),
          completedByUserId: 'acct-1',
        },
      });
      expect(prisma.accountingAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'PAYMENT_REQUEST_COMPLETED' }),
      });
    });

    it('remembers the receipt before posting it, so a failure can be resumed', async () => {
      await service.complete(user, 'req-1', dto);

      const updates = prisma.accountingPaymentRequest.update.mock.calls.map(
        (call: Array<{ data: object }>) => call[0].data,
      );
      expect(updates[0]).toEqual({ receiptId: 'rcpt-1' });
    });

    it('only completes a pending request', async () => {
      prisma.accountingPaymentRequest.findFirst.mockResolvedValue(
        request({ status: 'REJECTED' }),
      );

      await expect(service.complete(user, 'req-1', dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(receivables.createReceipt).not.toHaveBeenCalled();
    });

    it('asks for a rejection when the invoice is no longer open', async () => {
      prisma.accountingReceivableDocument.findFirst.mockResolvedValue(
        invoice({ status: 'REVERSED' }),
      );

      await expect(service.complete(user, 'req-1', dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(receivables.createReceipt).not.toHaveBeenCalled();
    });

    it('asks for a rejection when the invoice now owes less than was requested', async () => {
      receivables.invoiceBalance.mockResolvedValue({
        outstandingAmount: '4000.00',
      });

      await expect(service.complete(user, 'req-1', dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(receivables.createReceipt).not.toHaveBeenCalled();
    });

    it('will not let two accountants record the same request', async () => {
      prisma.accountingPaymentRequest.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(service.complete(user, 'req-1', dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(receivables.createReceipt).not.toHaveBeenCalled();
    });

    it('frees the request for another attempt when the receipt cannot be created', async () => {
      receivables.createReceipt.mockRejectedValue(
        new BadRequestException('Cash account inactive'),
      );

      await expect(service.complete(user, 'req-1', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.accountingPaymentRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { processingStartedAt: null },
      });
      expect(receivables.postReceipt).not.toHaveBeenCalled();
    });

    describe('resuming a completion that stopped part way', () => {
      beforeEach(() => {
        prisma.accountingPaymentRequest.findFirst.mockResolvedValue(
          request({ receiptId: 'rcpt-1', processingStartedAt: new Date() }),
        );
      });

      it('does not create a second receipt', async () => {
        await service.complete(user, 'req-1', dto);

        expect(receivables.createReceipt).not.toHaveBeenCalled();
        expect(receivables.invoiceBalance).not.toHaveBeenCalled();
      });

      it('posts a receipt that is still a draft, then allocates it', async () => {
        await service.complete(user, 'req-1', dto);

        expect(receivables.postReceipt).toHaveBeenCalledTimes(1);
        expect(receivables.allocateReceipt).toHaveBeenCalledTimes(1);
      });

      it('only allocates a receipt that is already posted', async () => {
        prisma.accountingReceivableReceipt.findFirst.mockResolvedValue({
          status: 'POSTED',
          receiptNumber: 'ARR26-00007',
        });

        await service.complete(user, 'req-1', dto);

        expect(receivables.postReceipt).not.toHaveBeenCalled();
        expect(receivables.allocateReceipt).toHaveBeenCalledTimes(1);
      });

      it('only finishes off when the receipt is already posted and allocated', async () => {
        prisma.accountingReceivableReceipt.findFirst.mockResolvedValue({
          status: 'POSTED',
          receiptNumber: 'ARR26-00007',
        });
        prisma.accountingReceivableAllocation.findFirst.mockResolvedValue({
          id: 'alloc-1',
        });

        await service.complete(user, 'req-1', dto);

        expect(receivables.postReceipt).not.toHaveBeenCalled();
        expect(receivables.allocateReceipt).not.toHaveBeenCalled();
        expect(prisma.accountingPaymentRequest.update).toHaveBeenCalledWith({
          where: { id: 'req-1' },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        });
      });

      it('stays pending, ready to resume again, if posting fails', async () => {
        receivables.postReceipt.mockRejectedValue(
          new ConflictException('period closed'),
        );

        await expect(
          service.complete(user, 'req-1', dto),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.accountingPaymentRequest.update).not.toHaveBeenCalledWith(
          {
            where: { id: 'req-1' },
            data: expect.objectContaining({ status: 'COMPLETED' }),
          },
        );
      });
    });
  });
});
