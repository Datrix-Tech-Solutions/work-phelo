/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountingMasterDataService } from '../accounting-master-data.service';
import { CashbookService } from '../cashbook.service';
import { ReceivablesService } from '../receivables.service';
import { SourceProvisioningService } from './source-provisioning.service';
import { SourceTransactionsService } from './source-transactions.service';

const D = (value: string | number) => new Prisma.Decimal(value);

describe('SourceTransactionsService', () => {
  const uniqueError = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

  const source = { id: 'source-1', isActive: true };
  const entityType = { id: 'et-1', name: 'Marketing Client' };

  const line = (overrides: object) => ({
    id: 'l',
    sequence: 1,
    direction: 'CR',
    accountId: 'acct-revenue',
    taxTypeId: null,
    ...overrides,
  });
  const invoiceType = (overrides: object = {}) => ({
    id: 'tt-invoice',
    name: 'Client Invoice',
    code: 'INV',
    category: 'RECEIVABLE',
    isLinked: false,
    postsToCashbook: false,
    sourceTypeId: 'source-1',
    businessRoles: ['MARKETING CLIENT'],
    rule: {
      defaultCashAccountId: null,
      lines: [
        line({ id: 'ar', sequence: 1, direction: 'DR', accountId: 'acct-ar' }),
        line({
          id: 'rev',
          sequence: 2,
          direction: 'CR',
          accountId: 'acct-revenue',
        }),
      ],
    },
    ...overrides,
  });
  const receiptType = (overrides: object = {}) => ({
    id: 'tt-receipt',
    name: 'Client Receipt',
    code: 'RCPT',
    category: 'RECEIVABLE',
    isLinked: false,
    postsToCashbook: true,
    sourceTypeId: 'source-1',
    businessRoles: ['Marketing Client'],
    rule: {
      defaultCashAccountId: 'cash-1',
      lines: [
        line({
          id: 'rev',
          sequence: 1,
          direction: 'CR',
          accountId: 'acct-revenue',
        }),
      ],
    },
    ...overrides,
  });
  const entity = {
    id: 'entity-1',
    name: 'Dell Computers',
    type: 'Marketing Client',
    externalRef: 'MARKETING:client-1',
  };

  const createDto = (overrides: object = {}) =>
    ({
      tenantId: 'tenant-1',
      sourceModule: 'MARKETING',
      idempotencyKey: 'client-create:client-1',
      externalRef: 'client-1',
      entityName: 'Dell Computers',
      entityTypeId: 'et-1',
      transactionTypeId: 'tt-invoice',
      amount: 20000,
      ...overrides,
    }) as never;

  const makePrisma = () => ({
    sourceType: { findFirst: jest.fn() },
    transactionType: { findFirst: jest.fn(), findMany: jest.fn() },
    entityType: { findFirst: jest.fn(), findMany: jest.fn() },
    accountingCashAccount: { findMany: jest.fn() },
    subledgerAccount: { findFirst: jest.fn() },
    accountingSourceTransaction: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    accountingReceivableDocument: { findMany: jest.fn(), count: jest.fn() },
    accountingReceivableReceipt: { findMany: jest.fn(), count: jest.fn() },
    accountingReceivableAllocation: { groupBy: jest.fn() },
    cashbookTransaction: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  });

  let prisma: ReturnType<typeof makePrisma>;
  let provisioning: { ensure: jest.Mock };
  let masterData: { getConfig: jest.Mock; ensureSourceEntity: jest.Mock };
  let receivables: { createInvoice: jest.Mock };
  let cashbook: { createReceipt: jest.Mock };
  let service: SourceTransactionsService;

  beforeEach(() => {
    prisma = makePrisma();
    provisioning = { ensure: jest.fn().mockResolvedValue({ ...source }) };
    masterData = {
      getConfig: jest.fn().mockResolvedValue({ baseCurrency: 'GHS' }),
      ensureSourceEntity: jest.fn().mockResolvedValue({ ...entity }),
    };
    receivables = {
      createInvoice: jest.fn().mockResolvedValue({ id: 'invoice-1' }),
    };
    cashbook = {
      createReceipt: jest.fn().mockResolvedValue({ id: 'receipt-1' }),
    };

    prisma.sourceType.findFirst.mockResolvedValue({
      id: 'source-1',
      module: 'MARKETING',
      name: 'Client Billing',
      isActive: true,
    });
    prisma.transactionType.findMany.mockResolvedValue([invoiceType()]);
    prisma.transactionType.findFirst.mockResolvedValue(invoiceType());
    prisma.entityType.findMany.mockResolvedValue([entityType]);
    prisma.entityType.findFirst.mockResolvedValue(entityType);
    prisma.accountingCashAccount.findMany.mockResolvedValue([{ id: 'cash-1' }]);
    prisma.subledgerAccount.findFirst.mockResolvedValue({ ...entity });
    prisma.accountingSourceTransaction.create.mockResolvedValue({
      id: 'req-1',
    });
    prisma.accountingSourceTransaction.update.mockResolvedValue({});
    prisma.accountingSourceTransaction.delete.mockResolvedValue({});
    prisma.accountingSourceTransaction.findMany.mockResolvedValue([]);
    prisma.accountingReceivableDocument.findMany.mockResolvedValue([]);
    prisma.accountingReceivableDocument.count.mockResolvedValue(0);
    prisma.accountingReceivableReceipt.findMany.mockResolvedValue([]);
    prisma.accountingReceivableReceipt.count.mockResolvedValue(0);
    prisma.accountingReceivableAllocation.groupBy.mockResolvedValue([]);
    prisma.cashbookTransaction.findMany.mockResolvedValue([]);
    prisma.cashbookTransaction.count.mockResolvedValue(0);
    prisma.cashbookTransaction.groupBy.mockResolvedValue([]);

    service = new SourceTransactionsService(
      prisma as unknown as PrismaService,
      provisioning as unknown as SourceProvisioningService,
      masterData as unknown as AccountingMasterDataService,
      receivables as unknown as ReceivablesService,
      cashbook as unknown as CashbookService,
    );
  });

  describe('getOptions', () => {
    it('refuses modules that are not registered', async () => {
      await expect(
        service.getOptions('tenant-1', 'RECRUITMENT'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('is not ready while the source is unlinked', async () => {
      provisioning.ensure.mockResolvedValue({ ...source, isActive: false });

      await expect(
        service.getOptions('tenant-1', 'MARKETING'),
      ).resolves.toMatchObject({
        ready: false,
        reason: 'SOURCE_NOT_LINKED',
      });
    });

    it('is not ready without a base currency', async () => {
      masterData.getConfig.mockResolvedValue({ baseCurrency: null });

      await expect(
        service.getOptions('tenant-1', 'MARKETING'),
      ).resolves.toMatchObject({
        ready: false,
        reason: 'NO_BASE_CURRENCY',
      });
    });

    it('is not ready when no transaction type is linked', async () => {
      prisma.transactionType.findMany.mockResolvedValue([]);

      await expect(
        service.getOptions('tenant-1', 'MARKETING'),
      ).resolves.toMatchObject({
        ready: false,
        reason: 'NO_TRANSACTION_TYPES',
        baseCurrency: 'GHS',
      });
    });

    it('asks only for receivable, non-credit-note types linked to the source', async () => {
      await service.getOptions('tenant-1', 'MARKETING');

      expect(prisma.transactionType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            sourceTypeId: 'source-1',
            category: 'RECEIVABLE',
            isLinked: false,
          },
        }),
      );
    });

    it('offers the entity types named on the linked transaction types, whatever their case', async () => {
      prisma.transactionType.findMany.mockResolvedValue([
        invoiceType(),
        receiptType(),
      ]);

      const options = await service.getOptions('tenant-1', 'MARKETING');

      expect(options).toEqual({
        ready: true,
        baseCurrency: 'GHS',
        entityTypes: [{ id: 'et-1', name: 'Marketing Client' }],
        transactionTypes: [
          { id: 'tt-invoice', name: 'Client Invoice', entityTypeIds: ['et-1'] },
          { id: 'tt-receipt', name: 'Client Receipt', entityTypeIds: ['et-1'] },
        ],
      });
    });

    it('does not offer an entity type nobody linked a transaction type to', async () => {
      prisma.entityType.findMany.mockResolvedValue([
        entityType,
        { id: 'et-2', name: 'Supplier' },
      ]);

      const options = await service.getOptions('tenant-1', 'MARKETING');

      expect(options.entityTypes).toEqual([
        { id: 'et-1', name: 'Marketing Client' },
      ]);
    });

    it('is not ready when the linked types name no existing entity type', async () => {
      prisma.transactionType.findMany.mockResolvedValue([
        invoiceType({ businessRoles: ['NOBODY'] }),
      ]);

      await expect(
        service.getOptions('tenant-1', 'MARKETING'),
      ).resolves.toMatchObject({
        ready: false,
        reason: 'NO_ENTITY_TYPE',
      });
    });

    it.each([
      ['has no rule', { rule: null }],
      [
        'has a rule with no lines',
        { rule: { defaultCashAccountId: null, lines: [] } },
      ],
      [
        'has no receivable line',
        {
          rule: {
            defaultCashAccountId: null,
            lines: [
              line({ id: 'a', direction: 'CR' }),
              line({ id: 'b', direction: 'CR' }),
            ],
          },
        },
      ],
      [
        'has only a receivable line',
        {
          rule: {
            defaultCashAccountId: null,
            lines: [line({ id: 'ar', direction: 'DR' })],
          },
        },
      ],
    ])('leaves out an invoice type that %s', async (_name, overrides) => {
      prisma.transactionType.findMany.mockResolvedValue([
        invoiceType(overrides),
      ]);

      await expect(
        service.getOptions('tenant-1', 'MARKETING'),
      ).resolves.toMatchObject({
        ready: false,
        reason: 'NO_TRANSACTION_TYPES',
      });
    });

    it('leaves out a receipt type without a usable default cash account', async () => {
      prisma.transactionType.findMany.mockResolvedValue([receiptType()]);
      prisma.accountingCashAccount.findMany.mockResolvedValue([]);

      await expect(
        service.getOptions('tenant-1', 'MARKETING'),
      ).resolves.toMatchObject({
        ready: false,
        reason: 'NO_TRANSACTION_TYPES',
      });
      expect(prisma.accountingCashAccount.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          id: { in: ['cash-1'] },
          isActive: true,
          currency: 'GHS',
        },
        select: { id: true },
      });
    });

    it('leaves out a receipt type that names no default cash account', async () => {
      prisma.transactionType.findMany.mockResolvedValue([
        receiptType({
          rule: { defaultCashAccountId: null, lines: [line({})] },
        }),
      ]);

      await expect(
        service.getOptions('tenant-1', 'MARKETING'),
      ).resolves.toMatchObject({
        ready: false,
      });
    });
  });

  describe('getSetup', () => {
    it('returns not found for a source that does not exist', async () => {
      prisma.sourceType.findFirst.mockResolvedValue(null);

      await expect(
        service.getSetup('tenant-1', 'source-9'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('says nothing is to be set up for modules that do not raise transactions', async () => {
      prisma.sourceType.findFirst.mockResolvedValue({
        id: 'source-hr',
        module: 'HR',
        name: 'Payroll',
        isActive: true,
      });

      await expect(service.getSetup('tenant-1', 'source-hr')).resolves.toEqual({
        supported: false,
      });
    });

    it('is ready when the source is linked and a usable transaction type names an entity type', async () => {
      const setup = await service.getSetup('tenant-1', 'source-1');

      expect(setup).toMatchObject({
        supported: true,
        module: 'MARKETING',
        sourceName: 'Client Billing',
        linked: true,
        baseCurrency: 'GHS',
        defaultEntityType: { id: 'et-1', name: 'Marketing Client' },
        entityTypes: [{ id: 'et-1', name: 'Marketing Client' }],
        ready: true,
        reason: null,
      });
      expect(setup.supported && setup.transactionTypes).toEqual([
        {
          id: 'tt-invoice',
          name: 'Client Invoice',
          usable: true,
          problem: null,
        },
      ]);
    });

    it('is not ready while the source is unlinked, and says that first', async () => {
      prisma.sourceType.findFirst.mockResolvedValue({
        id: 'source-1',
        module: 'MARKETING',
        name: 'Client Billing',
        isActive: false,
      });

      await expect(
        service.getSetup('tenant-1', 'source-1'),
      ).resolves.toMatchObject({
        linked: false,
        ready: false,
        reason: 'SOURCE_NOT_LINKED',
      });
    });

    it('is not ready without a base currency', async () => {
      masterData.getConfig.mockResolvedValue({ baseCurrency: null });

      await expect(
        service.getSetup('tenant-1', 'source-1'),
      ).resolves.toMatchObject({
        baseCurrency: null,
        ready: false,
        reason: 'NO_BASE_CURRENCY',
      });
    });

    it('keeps every linked type and says why each unusable one cannot be used', async () => {
      prisma.transactionType.findMany.mockResolvedValue([
        invoiceType(),
        invoiceType({ id: 'tt-norule', name: 'No Rule', rule: null }),
        invoiceType({
          id: 'tt-credit',
          name: 'Credit Note',
          isLinked: true,
        }),
        invoiceType({
          id: 'tt-payable',
          name: 'Supplier Bill',
          category: 'PAYABLE',
        }),
        receiptType({
          id: 'tt-receipt-nocash',
          name: 'No Cash',
          rule: { defaultCashAccountId: null, lines: [line({})] },
        }),
        invoiceType({
          id: 'tt-noroles',
          name: 'No Roles',
          businessRoles: ['NOBODY'],
        }),
      ]);

      const setup = await service.getSetup('tenant-1', 'source-1');

      expect(setup.supported && setup.transactionTypes).toEqual([
        {
          id: 'tt-invoice',
          name: 'Client Invoice',
          usable: true,
          problem: null,
        },
        {
          id: 'tt-norule',
          name: 'No Rule',
          usable: false,
          problem: 'Configure the rule for this type first',
        },
        {
          id: 'tt-credit',
          name: 'Credit Note',
          usable: false,
          problem:
            'Credit-note types cannot be used - they need an original invoice',
        },
        {
          id: 'tt-payable',
          name: 'Supplier Bill',
          usable: false,
          problem: 'Only receivable transaction types can be used',
        },
        {
          id: 'tt-receipt-nocash',
          name: 'No Cash',
          usable: false,
          problem: 'Set a default cash account on the rule',
        },
        {
          id: 'tt-noroles',
          name: 'No Roles',
          usable: false,
          problem: "Name an existing entity type in the type's business roles",
        },
      ]);
    });

    it('is not ready when no linked type is usable', async () => {
      prisma.transactionType.findMany.mockResolvedValue([
        invoiceType({ rule: null }),
      ]);

      await expect(
        service.getSetup('tenant-1', 'source-1'),
      ).resolves.toMatchObject({
        ready: false,
        reason: 'NO_TRANSACTION_TYPES',
      });
    });
  });

  describe('create', () => {
    it('needs an entity type or an entity', async () => {
      await expect(
        service.create('user-1', createDto({ entityTypeId: undefined })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses while the module is not ready', async () => {
      provisioning.ensure.mockResolvedValue({ ...source, isActive: false });

      await expect(
        service.create('user-1', createDto()),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(receivables.createInvoice).not.toHaveBeenCalled();
    });

    it('refuses a transaction type that is not linked to the source', async () => {
      prisma.transactionType.findFirst.mockResolvedValue(
        invoiceType({ sourceTypeId: 'another-source' }),
      );

      await expect(
        service.create('user-1', createDto()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a transaction type that is not on offer', async () => {
      prisma.transactionType.findFirst.mockResolvedValue(
        invoiceType({ id: 'tt-other' }),
      );

      await expect(
        service.create('user-1', createDto({ transactionTypeId: 'tt-other' })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates the entity, then a draft invoice at quantity one for the amount', async () => {
      const result = await service.create('user-1', createDto());

      expect(masterData.ensureSourceEntity).toHaveBeenCalledWith('user-1', {
        tenantId: 'tenant-1',
        type: 'Marketing Client',
        externalRef: 'MARKETING:client-1',
        name: 'Dell Computers',
      });
      expect(receivables.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1', tenantId: 'tenant-1' }),
        {
          customerId: 'entity-1',
          documentDate: new Date().toISOString().slice(0, 10),
          currency: 'GHS',
          amount: 20000,
          quantity: 1,
          unitPrice: 20000,
          transactionTypeId: 'tt-invoice',
          description: undefined,
          sourceModule: 'MARKETING',
          sourceRecordId: 'client-1',
        },
      );
      expect(result).toEqual({
        entityId: 'entity-1',
        entityTypeId: 'et-1',
        transactionId: 'invoice-1',
        state: 'DRAFT',
      });
    });

    it('attributes the draft to the person who asked, not to the calling service', async () => {
      await service.create('user-42', createDto());

      expect(receivables.createInvoice.mock.calls[0][0].id).toBe('user-42');
    });

    it('records which document the request became', async () => {
      await service.create('user-1', createDto());

      expect(prisma.accountingSourceTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          sourceModule: 'MARKETING',
          idempotencyKey: 'client-create:client-1',
          kind: 'INVOICE',
          requestedByUserId: 'user-1',
        }),
      });
      expect(prisma.accountingSourceTransaction.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { documentId: 'invoice-1', entityId: 'entity-1' },
      });
    });

    it('creates a draft cashbook receipt from the type’s defaults for a receipt type', async () => {
      prisma.transactionType.findMany.mockResolvedValue([receiptType()]);
      prisma.transactionType.findFirst.mockResolvedValue(receiptType());

      const result = await service.create(
        'user-1',
        createDto({ transactionTypeId: 'tt-receipt', description: 'Deposit' }),
      );

      expect(receivables.createInvoice).not.toHaveBeenCalled();
      expect(cashbook.createReceipt).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' }),
        {
          cashAccountId: 'cash-1',
          transactionTypeId: 'tt-receipt',
          amount: 20000,
          quantity: 1,
          unitPrice: 20000,
          currency: 'GHS',
          transactionDate: new Date().toISOString().slice(0, 10),
          // Not known here - the accountant sets the real method before posting.
          settlementMethod: 'OTHER',
          description: 'Deposit',
          offsetGlAccountId: 'acct-revenue',
          offsetSubledgerAccountId: 'entity-1',
          counterpartyType: 'CUSTOMER',
          counterpartyId: 'entity-1',
          sourceModule: 'MARKETING',
          sourceRecordId: 'client-1',
        },
      );
      expect(result.transactionId).toBe('receipt-1');
      expect(prisma.accountingSourceTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ kind: 'RECEIPT' }),
      });
    });

    it('refuses an entity type the transaction type is not meant for', async () => {
      prisma.entityType.findFirst.mockResolvedValue({
        id: 'et-2',
        name: 'Supplier',
      });
      masterData.ensureSourceEntity.mockResolvedValue({
        ...entity,
        type: 'Supplier',
      });

      await expect(
        service.create('user-1', createDto({ entityTypeId: 'et-2' })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(receivables.createInvoice).not.toHaveBeenCalled();
    });

    describe('later transactions', () => {
      it('use the entity the record already has', async () => {
        await service.create(
          'user-1',
          createDto({
            entityId: 'entity-1',
            entityTypeId: undefined,
            idempotencyKey: 'k2',
          }),
        );

        expect(masterData.ensureSourceEntity).not.toHaveBeenCalled();
        expect(receivables.createInvoice.mock.calls[0][1].customerId).toBe(
          'entity-1',
        );
      });

      it('never use an entity that belongs to another record', async () => {
        prisma.subledgerAccount.findFirst.mockResolvedValue({
          ...entity,
          externalRef: 'MARKETING:someone-else',
        });

        await expect(
          service.create(
            'user-1',
            createDto({ entityId: 'entity-1', entityTypeId: undefined }),
          ),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(receivables.createInvoice).not.toHaveBeenCalled();
      });
    });

    describe('idempotency', () => {
      it('returns the transaction already raised for the same key without creating another', async () => {
        prisma.accountingSourceTransaction.create.mockRejectedValue(
          uniqueError(),
        );
        prisma.accountingSourceTransaction.findUnique.mockResolvedValue({
          id: 'req-1',
          documentId: 'invoice-1',
          entityId: 'entity-1',
        });

        const result = await service.create('user-1', createDto());

        expect(result).toEqual({
          entityId: 'entity-1',
          entityTypeId: 'et-1',
          transactionId: 'invoice-1',
          state: 'DRAFT',
        });
        expect(receivables.createInvoice).not.toHaveBeenCalled();
        expect(masterData.ensureSourceEntity).not.toHaveBeenCalled();
      });

      it('asks the caller to retry while the first request is still being processed', async () => {
        prisma.accountingSourceTransaction.create.mockRejectedValue(
          uniqueError(),
        );
        prisma.accountingSourceTransaction.findUnique.mockResolvedValue({
          id: 'req-1',
          documentId: null,
          entityId: '',
        });

        await expect(
          service.create('user-1', createDto()),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(receivables.createInvoice).not.toHaveBeenCalled();
      });

      it('frees the key when the draft cannot be created, so the same submission can be retried', async () => {
        receivables.createInvoice.mockRejectedValue(
          new ConflictException('no AR line'),
        );

        await expect(
          service.create('user-1', createDto()),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.accountingSourceTransaction.delete).toHaveBeenCalledWith({
          where: { id: 'req-1' },
        });
      });
    });
  });

  describe('list', () => {
    const when = (day: number) => new Date(`2026-10-0${day}T10:00:00.000Z`);

    it('merges invoices, receipts and direct entries, newest first, with their states', async () => {
      prisma.accountingReceivableDocument.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          status: 'POSTED',
          documentType: 'INVOICE',
          documentNumber: 'INV26-00001',
          transactionTypeId: 'tt-invoice',
          totalAmount: D('20000'),
          currency: 'GHS',
          rejectionReason: null,
          createdAt: when(1),
        },
        {
          id: 'inv-2',
          status: 'REJECTED',
          documentType: 'INVOICE',
          documentNumber: 'INV26-00002',
          transactionTypeId: 'tt-invoice',
          totalAmount: D('500'),
          currency: 'GHS',
          rejectionReason: 'Wrong entity',
          createdAt: when(3),
        },
      ]);
      prisma.accountingReceivableReceipt.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          status: 'POSTED',
          receiptNumber: 'ARR26-00001',
          amount: D('8000'),
          currency: 'GHS',
          createdAt: when(2),
        },
      ]);
      prisma.cashbookTransaction.findMany.mockResolvedValue([
        {
          id: 'cb-1',
          status: 'DRAFT',
          transactionType: 'RECEIPT',
          transactionNumber: 'RCPT26-00001',
          amount: D('100'),
          currency: 'GHS',
          rejectionReason: null,
          createdAt: when(4),
        },
      ]);
      prisma.accountingSourceTransaction.findMany.mockResolvedValue([
        { documentId: 'cb-1', transactionTypeId: 'tt-receipt' },
      ]);
      prisma.transactionType.findMany.mockResolvedValue([
        { id: 'tt-invoice', name: 'Client Invoice' },
        { id: 'tt-receipt', name: 'Client Receipt' },
      ]);
      prisma.accountingReceivableDocument.count.mockResolvedValue(2);
      prisma.accountingReceivableReceipt.count.mockResolvedValue(1);
      prisma.cashbookTransaction.count.mockResolvedValue(1);
      prisma.accountingReceivableAllocation.groupBy.mockResolvedValue([
        { invoiceId: 'inv-1', _sum: { amount: D('8000') } },
      ]);

      const result = await service.list({
        tenantId: 'tenant-1',
        sourceModule: 'MARKETING',
        entityId: 'entity-1',
      });

      expect(result.items.map((i) => i.id)).toEqual([
        'cb-1',
        'inv-2',
        'rec-1',
        'inv-1',
      ]);
      expect(result.items[0]).toMatchObject({
        state: 'DRAFT',
        stateLabel: 'Draft',
        transactionTypeName: 'Client Receipt',
        documentNumber: 'RCPT26-00001',
        receivedAmount: '0.00',
      });
      expect(result.items[1]).toMatchObject({
        state: 'REJECTED',
        stateLabel: 'Rejected',
        reason: 'Wrong entity',
      });
      expect(result.items[2]).toMatchObject({
        transactionTypeName: 'Receipt',
        receivedAmount: '8000.00',
      });
      expect(result.items[3]).toMatchObject({
        id: 'inv-1',
        state: 'POSTED',
        amount: '20000.00',
        receivedAmount: '8000.00',
      });
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 4,
        totalPages: 1,
      });
    });

    it('does not list a customer receipt twice', async () => {
      await service.list({
        tenantId: 'tenant-1',
        sourceModule: 'MARKETING',
        entityId: 'entity-1',
      });

      expect(prisma.cashbookTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            offsetSubledgerAccountId: 'entity-1',
            receivableReceipt: { is: null },
          },
        }),
      );
    });

    it('pages across the merged list', async () => {
      const docs = [1, 2, 3].map((day) => ({
        id: `inv-${day}`,
        status: 'DRAFT',
        documentType: 'INVOICE',
        documentNumber: `INV-${day}`,
        transactionTypeId: null,
        totalAmount: D('10'),
        currency: 'GHS',
        rejectionReason: null,
        createdAt: when(day),
      }));
      prisma.accountingReceivableDocument.findMany.mockResolvedValue(docs);
      prisma.accountingReceivableDocument.count.mockResolvedValue(3);

      const result = await service.list({
        tenantId: 'tenant-1',
        sourceModule: 'MARKETING',
        entityId: 'entity-1',
        page: 2,
        limit: 2,
      });

      expect(result.items.map((i) => i.id)).toEqual(['inv-1']);
      expect(result.meta).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });
  });

  describe('receiptsSummary', () => {
    const dto = (overrides: object = {}) =>
      ({
        tenantId: 'tenant-1',
        sourceModule: 'MARKETING',
        entityIds: ['entity-1', 'entity-2'],
        ...overrides,
      }) as never;

    it('totals posted receipts per entity in the base currency, zero for entities with none', async () => {
      prisma.cashbookTransaction.groupBy.mockResolvedValue([
        { offsetSubledgerAccountId: 'entity-1', _sum: { amount: D('9000.5') } },
      ]);

      const result = await service.receiptsSummary(dto());

      expect(prisma.cashbookTransaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            offsetSubledgerAccountId: { in: ['entity-1', 'entity-2'] },
            transactionType: 'RECEIPT',
            status: 'POSTED',
            currency: 'GHS',
          },
        }),
      );
      expect(result).toEqual({
        currency: 'GHS',
        entities: [
          { entityId: 'entity-1', receivedAmount: '9000.50' },
          { entityId: 'entity-2', receivedAmount: '0.00' },
        ],
        transactions: [],
      });
    });

    it('reports what was received against each asked-about transaction', async () => {
      prisma.accountingReceivableDocument.findMany.mockResolvedValue([
        { id: 'inv-1' },
      ]);
      prisma.cashbookTransaction.findMany.mockResolvedValue([
        { id: 'cb-1', amount: D('300') },
      ]);
      prisma.accountingReceivableAllocation.groupBy.mockResolvedValue([
        { invoiceId: 'inv-1', _sum: { amount: D('5000.25') } },
      ]);

      const result = await service.receiptsSummary(
        dto({ transactionIds: ['inv-1', 'cb-1', 'unknown'] }),
      );

      expect(result.transactions).toEqual([
        { transactionId: 'inv-1', receivedAmount: '5000.25' },
        { transactionId: 'cb-1', receivedAmount: '300.00' },
        { transactionId: 'unknown', receivedAmount: '0.00' },
      ]);
      expect(
        prisma.accountingReceivableAllocation.groupBy,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            invoiceId: { in: ['inv-1'] },
            sourceType: 'RECEIPT',
            reversedAt: null,
          },
        }),
      );
    });
  });
});
