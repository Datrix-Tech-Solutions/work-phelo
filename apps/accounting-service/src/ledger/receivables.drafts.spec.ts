/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../prisma/generated/client';
import {
  RejectDraftDto,
  UpdateReceivableInvoiceDraftDto,
} from './dto/draft-actions.dto';
import { ReceivablesService } from './receivables.service';

const D = (value: string | number) => new Prisma.Decimal(value);

describe('ReceivablesService draft invoices', () => {
  const user = {
    id: 'user-1',
    tenantId: 'tenant-1',
    role: 'EMPLOYEE',
    permissions: [],
  } as unknown as RequestUser;

  const draft = (overrides: object = {}) => ({
    id: 'inv-1',
    tenantId: 'tenant-1',
    customerId: 'entity-1',
    documentType: 'INVOICE',
    status: 'DRAFT',
    currency: 'GHS',
    subtotalAmount: D('1000'),
    quantity: D('1'),
    unitPrice: D('1000'),
    transactionTypeId: 'tt-1',
    sourceModule: 'MARKETING',
    ...overrides,
  });

  const makePrisma = () => ({
    accountingReceivableDocument: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    subledgerAccount: { findFirst: jest.fn() },
    accountingCurrency: { findUnique: jest.fn() },
    costCentre: { findFirst: jest.fn() },
    transactionType: { findFirst: jest.fn() },
    transactionTypeRule: { findFirst: jest.fn() },
    accountingAuditLog: { create: jest.fn() },
  });

  let prisma: ReturnType<typeof makePrisma>;
  let notifier: { notify: jest.Mock };
  let service: ReceivablesService;

  beforeEach(() => {
    prisma = makePrisma();
    notifier = { notify: jest.fn().mockResolvedValue(undefined) };
    prisma.accountingReceivableDocument.findFirst.mockResolvedValue(draft());
    prisma.accountingReceivableDocument.updateMany.mockResolvedValue({
      count: 1,
    });
    prisma.subledgerAccount.findFirst.mockResolvedValue({
      id: 'entity-1',
      status: 'ACTIVE',
      currency: null,
    });
    prisma.accountingCurrency.findUnique.mockResolvedValue({ isActive: true });
    prisma.accountingAuditLog.create.mockResolvedValue({});
    service = new ReceivablesService(
      prisma as never,
      {} as never,
      {} as never,
      notifier as never,
    );
  });

  describe('updateInvoiceDraft', () => {
    it('needs at least one field', async () => {
      await expect(
        service.updateInvoiceDraft(user, 'inv-1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns not found for an invoice that does not exist', async () => {
      prisma.accountingReceivableDocument.findFirst.mockResolvedValue(null);

      await expect(
        service.updateInvoiceDraft(user, 'inv-1', { description: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each(['POSTED', 'REVERSED', 'REJECTED'])(
      'refuses to edit a %s invoice',
      async (status) => {
        prisma.accountingReceivableDocument.findFirst.mockResolvedValue(
          draft({ status }),
        );

        await expect(
          service.updateInvoiceDraft(user, 'inv-1', { description: 'x' }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(
          prisma.accountingReceivableDocument.updateMany,
        ).not.toHaveBeenCalled();
      },
    );

    it('changes the completing fields, only while the invoice is still a draft', async () => {
      await service.updateInvoiceDraft(user, 'inv-1', {
        documentDate: '2026-10-05',
        dueDate: '2026-11-05',
        description: ' Annual premium ',
        externalReference: 'PO-77',
      });

      expect(
        prisma.accountingReceivableDocument.updateMany,
      ).toHaveBeenCalledWith({
        where: { id: 'inv-1', tenantId: 'tenant-1', status: 'DRAFT' },
        data: {
          updatedByUserId: 'user-1',
          documentDate: new Date('2026-10-05'),
          dueDate: new Date('2026-11-05'),
          description: 'Annual premium',
          externalReference: 'PO-77',
        },
      });
      expect(prisma.accountingAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'RECEIVABLE_INVOICE_DRAFT_UPDATED',
          entityId: 'inv-1',
        }),
      });
    });

    it('never touches the amount, quantity, unit price, entity or transaction type', async () => {
      await service.updateInvoiceDraft(user, 'inv-1', {
        documentDate: '2026-10-05',
        currency: 'GHS',
        description: 'x',
      });

      const data =
        prisma.accountingReceivableDocument.updateMany.mock.calls[0][0].data;
      for (const locked of [
        'subtotalAmount',
        'totalAmount',
        'quantity',
        'unitPrice',
        'customerId',
        'transactionTypeId',
        'offsetGlAccountId',
        'arAccountId',
      ]) {
        expect(data).not.toHaveProperty(locked);
      }
    });

    it('rejects an attempt to send the locked fields at all', async () => {
      const dto = plainToInstance(UpdateReceivableInvoiceDraftDto, {
        amount: 5,
        quantity: 2,
        unitPrice: 2.5,
        customerId: 'someone-else',
        transactionTypeId: 'tt-2',
      });

      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      expect(errors.map((e) => e.property).sort()).toEqual([
        'amount',
        'customerId',
        'quantity',
        'transactionTypeId',
        'unitPrice',
      ]);
    });

    it('checks a changed currency is active and matches the entity', async () => {
      prisma.subledgerAccount.findFirst.mockResolvedValue({
        id: 'entity-1',
        status: 'ACTIVE',
        currency: 'GHS',
      });

      await expect(
        service.updateInvoiceDraft(user, 'inv-1', { currency: 'USD' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(
        prisma.accountingReceivableDocument.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('refuses a currency that is not active', async () => {
      prisma.accountingCurrency.findUnique.mockResolvedValue({
        isActive: false,
      });

      await expect(
        service.updateInvoiceDraft(user, 'inv-1', { currency: 'USD' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('clears the cost centre with null without looking one up', async () => {
      await service.updateInvoiceDraft(user, 'inv-1', { costCentreId: null });

      expect(prisma.costCentre.findFirst).not.toHaveBeenCalled();
      expect(
        prisma.accountingReceivableDocument.updateMany.mock.calls[0][0].data
          .costCentreId,
      ).toBeNull();
    });

    it('refuses a cost centre that does not exist', async () => {
      prisma.costCentre.findFirst.mockResolvedValue(null);

      await expect(
        service.updateInvoiceDraft(user, 'inv-1', {
          costCentreId: '11111111-1111-4111-8111-111111111111',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    describe('tax lines', () => {
      const rule = (taxRate: string) => ({
        lines: [
          {
            id: 'ar',
            direction: 'DR',
            accountId: 'acct-ar',
            taxTypeId: null,
            taxType: null,
          },
          {
            id: 'rev',
            direction: 'CR',
            accountId: 'acct-rev',
            taxTypeId: null,
            taxType: null,
          },
          {
            id: 'vat',
            direction: 'CR',
            accountId: 'acct-vat',
            taxTypeId: 'tax-1',
            taxType: { rate: taxRate },
          },
        ],
      });

      beforeEach(() => {
        prisma.transactionType.findFirst.mockResolvedValue({
          id: 'tt-1',
          category: 'RECEIVABLE',
          isLinked: false,
          code: 'INV',
          name: 'Client Invoice',
        });
        prisma.transactionTypeRule.findFirst.mockResolvedValue(rule('12.5'));
      });

      it('recomputes the tax on the unchanged subtotal and keeps the resolved accounts', async () => {
        await service.updateInvoiceDraft(user, 'inv-1', {
          selectedTaxTypeIds: ['tax-1'],
        });

        const data =
          prisma.accountingReceivableDocument.updateMany.mock.calls[0][0].data;
        expect(data.taxAmount.toString()).toBe('125');
        expect(data.totalAmount.toString()).toBe('1125');
        expect(data.taxBreakdown).toEqual([
          {
            glAccountId: 'acct-vat',
            taxTypeId: 'tax-1',
            amount: '125',
            direction: 'CR',
          },
        ]);
        expect(data).not.toHaveProperty('subtotalAmount');
        expect(data).not.toHaveProperty('arAccountId');
        expect(data).not.toHaveProperty('offsetGlAccountId');
      });

      it('removes all tax with an empty selection', async () => {
        await service.updateInvoiceDraft(user, 'inv-1', {
          selectedTaxTypeIds: [],
        });

        const data =
          prisma.accountingReceivableDocument.updateMany.mock.calls[0][0].data;
        expect(data.taxAmount.toString()).toBe('0');
        expect(data.totalAmount.toString()).toBe('1000');
        expect(data.taxBreakdown).toEqual([]);
      });

      it('cannot change tax on an invoice that has no transaction type', async () => {
        prisma.accountingReceivableDocument.findFirst.mockResolvedValue(
          draft({ transactionTypeId: null }),
        );

        await expect(
          service.updateInvoiceDraft(user, 'inv-1', {
            selectedTaxTypeIds: ['tax-1'],
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      });
    });

    it('conflicts if someone else changed the invoice first', async () => {
      prisma.accountingReceivableDocument.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.updateInvoiceDraft(user, 'inv-1', { description: 'x' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('rejectInvoice', () => {
    beforeEach(() => {
      // After rejecting, the invoice is read back, and the notifier looks up its source module.
      prisma.accountingReceivableDocument.findFirst.mockResolvedValue(
        draft({ status: 'REJECTED', sourceModule: 'MARKETING' }),
      );
    });

    it('turns the draft down with a reason, and keeps the record', async () => {
      await service.rejectInvoice(user, 'inv-1', { reason: 'Wrong entity' });

      expect(
        prisma.accountingReceivableDocument.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          id: 'inv-1',
          tenantId: 'tenant-1',
          documentType: 'INVOICE',
          status: 'DRAFT',
        },
        data: {
          status: 'REJECTED',
          rejectedAt: expect.any(Date),
          rejectedByUserId: 'user-1',
          rejectionReason: 'Wrong entity',
          updatedByUserId: 'user-1',
        },
      });
      expect(prisma.accountingAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'RECEIVABLE_INVOICE_REJECTED',
          changedFields: { reason: 'Wrong entity' },
        }),
      });
    });

    it('tells the module that raised it', async () => {
      await service.rejectInvoice(user, 'inv-1', { reason: 'Wrong entity' });

      expect(notifier.notify).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        sourceModule: 'MARKETING',
        transactionId: 'inv-1',
        event: 'REJECTED',
      });
    });

    it('returns not found for an invoice that does not exist', async () => {
      prisma.accountingReceivableDocument.updateMany.mockResolvedValue({
        count: 0,
      });
      prisma.accountingReceivableDocument.findFirst.mockResolvedValue(null);

      await expect(
        service.rejectInvoice(user, 'inv-1', { reason: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(notifier.notify).not.toHaveBeenCalled();
    });

    it('only rejects a draft', async () => {
      prisma.accountingReceivableDocument.updateMany.mockResolvedValue({
        count: 0,
      });
      prisma.accountingReceivableDocument.findFirst.mockResolvedValue(
        draft({ status: 'POSTED' }),
      );

      await expect(
        service.rejectInvoice(user, 'inv-1', { reason: 'x' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(notifier.notify).not.toHaveBeenCalled();
    });

    it('needs a reason', async () => {
      const errors = await validate(
        plainToInstance(RejectDraftDto, { reason: '   ' }),
      );

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('telling the module what happened', () => {
    beforeEach(() => {
      prisma.accountingReceivableDocument.findFirst.mockResolvedValue({
        sourceModule: 'MARKETING',
      });
    });

    it('reports a posted invoice', async () => {
      jest
        .spyOn(service as any, 'postDocument')
        .mockResolvedValue({ id: 'inv-1' });

      await service.postInvoice(user, 'inv-1');

      expect(notifier.notify).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        sourceModule: 'MARKETING',
        transactionId: 'inv-1',
        event: 'POSTED',
      });
    });

    it('reports a reversed invoice against the original invoice id', async () => {
      jest
        .spyOn(service as any, 'reverseDocument')
        .mockResolvedValue({ id: 'reversal-1' });

      await service.reverseInvoice(user, 'inv-1', { reason: 'x' } as never);

      expect(notifier.notify).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        sourceModule: 'MARKETING',
        transactionId: 'inv-1',
        event: 'REVERSED',
      });
    });

    it('hands the notifier a missing source module for invoices that did not come from one (it ignores them)', async () => {
      prisma.accountingReceivableDocument.findFirst.mockResolvedValue({
        sourceModule: null,
      });
      jest
        .spyOn(service as any, 'postDocument')
        .mockResolvedValue({ id: 'inv-1' });

      await service.postInvoice(user, 'inv-1');

      expect(notifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({ sourceModule: null }),
      );
    });
  });
});
