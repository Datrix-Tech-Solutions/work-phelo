/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { InternalServiceClientError } from '@work-phelo/internal-auth';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingClientBillingState,
  MarketingClientProductStatus,
} from '../../prisma/generated/client';
import { AccountingClient } from '../accounting/accounting.client';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { PrismaService } from '../prisma/prisma.service';
import { ClientBillingService } from './client-billing.service';
import { AccountingEvent } from './dto/billing.dto';

describe('ClientBillingService', () => {
  const biller: RequestUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'sales@example.com',
    role: 'EMPLOYEE',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    firstName: 'Ada',
    moduleConfig: {},
    featureConfig: {},
    integrationConfig: {},
    permissions: [MarketingCrmSettingsPermission.CLIENTS_BILLING_CREATE],
  };
  const viewer: RequestUser = { ...biller, permissions: [] };

  const client = {
    id: 'client-1',
    companyName: 'Dell Computers',
    accountingEntityId: null as string | null,
    products: [
      { productId: 'p-1', status: MarketingClientProductStatus.PENDING },
      { productId: 'p-2', status: MarketingClientProductStatus.UNINTERESTED },
    ],
  };

  const raiseDto = {
    submissionId: '11111111-1111-4111-8111-111111111111',
    entityTypeId: 'entity-type-1',
    transactionTypeId: 'txn-type-1',
    amount: 20000,
    productId: 'p-1',
  };

  const makePrisma = () => {
    const tx = {
      marketingClient: { update: jest.fn() },
      marketingClientBilling: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      marketingClientProduct: { findUnique: jest.fn(), update: jest.fn() },
    };
    return {
      tx,
      marketingClient: {
        findFirst: jest.fn(),
        update: tx.marketingClient.update,
      },
      marketingClientBilling: {
        ...tx.marketingClientBilling,
        findMany: jest.fn(),
      },
      marketingClientProduct: tx.marketingClientProduct,
      marketingCrmSettingOption: { findMany: jest.fn() },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) =>
        Promise.resolve(fn(tx)),
      ),
    };
  };

  const makeAccounting = () => ({
    isConfigured: jest.fn(),
    getOptions: jest.fn(),
    createTransaction: jest.fn(),
    listTransactions: jest.fn(),
    receiptsSummary: jest.fn(),
  });

  let prisma: ReturnType<typeof makePrisma>;
  let accounting: ReturnType<typeof makeAccounting>;
  let service: ClientBillingService;

  beforeEach(() => {
    prisma = makePrisma();
    accounting = makeAccounting();
    accounting.isConfigured.mockReturnValue(true);
    prisma.marketingClient.findFirst.mockResolvedValue({ ...client });
    prisma.marketingClientBilling.findUnique.mockResolvedValue(null);
    prisma.marketingClientBilling.findMany.mockResolvedValue([]);
    prisma.marketingCrmSettingOption.findMany.mockResolvedValue([]);
    prisma.marketingClientBilling.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'billing-1', ...data }),
    );
    service = new ClientBillingService(
      prisma as unknown as PrismaService,
      accounting as unknown as AccountingClient,
    );
  });

  describe('getOptions', () => {
    const ready = {
      ready: true,
      baseCurrency: 'GHS',
      entityTypes: [{ id: 'e1', name: 'Marketing Client' }],
      transactionTypes: [{ id: 't1', name: 'Invoice', entityTypeIds: ['e1'] }],
    };

    it('is not ready, and says so, when the service is not configured', async () => {
      accounting.isConfigured.mockReturnValue(false);

      await expect(service.getOptions(biller)).resolves.toMatchObject({
        ready: false,
        reason: 'NOT_CONFIGURED',
        message: 'Accounting not set up',
      });
      expect(accounting.getOptions).not.toHaveBeenCalled();
    });

    it('returns what the form offers when accounting is ready', async () => {
      accounting.getOptions.mockResolvedValue(ready);

      await expect(service.getOptions(biller)).resolves.toMatchObject({
        canBill: true,
        ready: true,
        baseCurrency: 'GHS',
        entityTypes: ready.entityTypes,
        transactionTypes: ready.transactionTypes,
      });
      expect(accounting.getOptions).toHaveBeenCalledWith('tenant-1', 'user-1');
    });

    it('tells a user without the billing permission, separately from readiness', async () => {
      accounting.getOptions.mockResolvedValue(ready);

      await expect(service.getOptions(viewer)).resolves.toMatchObject({
        canBill: false,
        ready: true,
      });
    });

    it.each([
      [
        'accounting says it is not ready',
        { ...ready, ready: false, reason: 'SOURCE_NOT_LINKED' },
      ],
      ['there is no entity type', { ...ready, entityTypes: [] }],
      ['there is no transaction type', { ...ready, transactionTypes: [] }],
    ])('is "not set up" when %s', async (_name, options) => {
      accounting.getOptions.mockResolvedValue(options);

      await expect(service.getOptions(biller)).resolves.toMatchObject({
        ready: false,
        reason: 'NOT_SET_UP',
        message: 'Accounting not set up',
      });
    });

    it('is "not set up" when accounting answers with a client error', async () => {
      accounting.getOptions.mockRejectedValue(
        new InternalServiceClientError(
          'Accounting module is not enabled',
          false,
          400,
        ),
      );

      await expect(service.getOptions(biller)).resolves.toMatchObject({
        ready: false,
        reason: 'NOT_SET_UP',
      });
    });

    it('is "unavailable" when accounting cannot be reached', async () => {
      accounting.getOptions.mockRejectedValue(
        new InternalServiceClientError('connect ECONNREFUSED', true),
      );

      await expect(service.getOptions(biller)).resolves.toMatchObject({
        ready: false,
        reason: 'UNAVAILABLE',
        message: 'Accounting is currently unavailable',
      });
    });
  });

  describe('raise', () => {
    beforeEach(() => {
      accounting.createTransaction.mockResolvedValue({
        entityId: 'entity-1',
        entityTypeId: 'entity-type-1',
        transactionId: 'txn-1',
        state: 'DRAFT',
      });
    });

    it('refuses users without the billing permission', async () => {
      await expect(
        service.raise(viewer, 'client-1', raiseDto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(accounting.createTransaction).not.toHaveBeenCalled();
    });

    it('returns not found for a client the user cannot see', async () => {
      prisma.marketingClient.findFirst.mockResolvedValue(null);

      await expect(
        service.raise(biller, 'client-1', raiseDto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each([
      ['a product the client does not have', 'p-9'],
      ['an uninterested product', 'p-2'],
    ])('rejects %s', async (_name, productId) => {
      await expect(
        service.raise(biller, 'client-1', { ...raiseDto, productId }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(accounting.createTransaction).not.toHaveBeenCalled();
    });

    it('needs an entity type for the first transaction', async () => {
      await expect(
        service.raise(biller, 'client-1', {
          ...raiseDto,
          entityTypeId: undefined,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(accounting.createTransaction).not.toHaveBeenCalled();
    });

    it('sends the first transaction, keeps the entity, switches billing on and records the link', async () => {
      const result = await service.raise(biller, 'client-1', raiseDto);

      expect(accounting.createTransaction).toHaveBeenCalledWith(
        {
          tenantId: 'tenant-1',
          idempotencyKey: `client-billing:client-1:${raiseDto.submissionId}`,
          externalRef: 'client-1',
          entityName: 'Dell Computers',
          entityTypeId: 'entity-type-1',
          transactionTypeId: 'txn-type-1',
          amount: 20000,
        },
        'user-1',
      );
      expect(prisma.tx.marketingClient.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: {
          isBillable: true,
          updatedByUserId: 'user-1',
          accountingEntityId: 'entity-1',
          accountingEntityTypeId: 'entity-type-1',
        },
      });
      expect(prisma.tx.marketingClientBilling.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          clientId: 'client-1',
          productId: 'p-1',
          accountingTransactionId: 'txn-1',
          state: MarketingClientBillingState.SUBMITTED,
          amount: 20000,
          createdByUserId: 'user-1',
        }),
      });
      expect(result).toMatchObject({ accountingTransactionId: 'txn-1' });
    });

    it('never tells accounting which product it is for', async () => {
      await service.raise(biller, 'client-1', raiseDto);

      expect(
        JSON.stringify(accounting.createTransaction.mock.calls[0][0]),
      ).not.toContain('p-1');
    });

    it('reuses the entity for later transactions and does not touch it', async () => {
      prisma.marketingClient.findFirst.mockResolvedValue({
        ...client,
        accountingEntityId: 'entity-1',
      });

      await service.raise(biller, 'client-1', {
        ...raiseDto,
        entityTypeId: undefined,
      });

      const sent = accounting.createTransaction.mock.calls[0][0];
      expect(sent.entityId).toBe('entity-1');
      expect(sent.entityTypeId).toBeUndefined();
      expect(prisma.tx.marketingClient.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: { isBillable: true, updatedByUserId: 'user-1' },
      });
    });

    it('does not send the same submission twice', async () => {
      prisma.marketingClientBilling.findUnique.mockResolvedValue({
        id: 'billing-1',
        accountingTransactionId: 'txn-1',
        state: MarketingClientBillingState.SUBMITTED,
      });

      const result = await service.raise(biller, 'client-1', raiseDto);

      expect(accounting.createTransaction).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: 'billing-1',
        accountingTransactionId: 'txn-1',
        state: MarketingClientBillingState.SUBMITTED,
      });
    });

    it('changes nothing when accounting cannot take the transaction', async () => {
      accounting.createTransaction.mockRejectedValue(
        new InternalServiceClientError('connect ECONNREFUSED', true),
      );

      await expect(
        service.raise(biller, 'client-1', raiseDto),
      ).rejects.toBeInstanceOf(BadGatewayException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("passes accounting's own validation message through", async () => {
      accounting.createTransaction.mockRejectedValue(
        new InternalServiceClientError(
          'Transaction type is not linked to this source',
          false,
          400,
        ),
      );

      const error = (await service
        .raise(biller, 'client-1', raiseDto)
        .catch((e: unknown) => e)) as HttpException;
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(400);
      expect(error.message).toBe(
        'Transaction type is not linked to this source',
      );
    });
  });

  describe('listTransactions', () => {
    const item = (id: string, state: string) => ({
      id,
      state,
      stateLabel: state,
      amount: '20000.00',
      currency: 'GHS',
      transactionTypeName: 'Invoice',
      documentNumber: null,
      reason: null,
      receivedAmount: '0.00',
      createdAt: '2026-10-04T10:00:00.000Z',
    });

    it('is empty, without calling accounting, for a client with no entity yet', async () => {
      const result = await service.listTransactions(viewer, 'client-1');

      expect(result.items).toEqual([]);
      expect(accounting.listTransactions).not.toHaveBeenCalled();
    });

    it('shows accounting’s states and names the product for the ones raised here', async () => {
      prisma.marketingClient.findFirst.mockResolvedValue({
        ...client,
        accountingEntityId: 'entity-1',
      });
      accounting.listTransactions.mockResolvedValue({
        items: [item('txn-1', 'DRAFT'), item('txn-direct', 'POSTED')],
        meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      });
      prisma.marketingClientBilling.findMany
        .mockResolvedValueOnce([
          {
            id: 'b-1',
            productId: 'p-1',
            accountingTransactionId: 'txn-1',
            state: MarketingClientBillingState.SUBMITTED,
          },
        ])
        .mockResolvedValue([]);
      prisma.marketingCrmSettingOption.findMany.mockResolvedValue([
        { id: 'p-1', name: 'Fire Cover' },
      ]);

      const result = await service.listTransactions(viewer, 'client-1', {
        page: 1,
        limit: 20,
      });

      expect(accounting.listTransactions).toHaveBeenCalledWith(
        'tenant-1',
        'entity-1',
        { page: 1, limit: 20 },
        'user-1',
      );
      expect(result.items[0]).toMatchObject({
        id: 'txn-1',
        productId: 'p-1',
        productName: 'Fire Cover',
        raisedFromMarketing: true,
      });
      expect(result.items[1]).toMatchObject({
        id: 'txn-direct',
        productName: null,
        raisedFromMarketing: false,
      });
    });

    it('heals a state it never heard about, and the product status with it', async () => {
      prisma.marketingClient.findFirst.mockResolvedValue({
        ...client,
        accountingEntityId: 'entity-1',
      });
      accounting.listTransactions.mockResolvedValue({
        items: [item('txn-1', 'POSTED')],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      prisma.marketingClientBilling.findMany.mockResolvedValue([
        {
          id: 'b-1',
          productId: 'p-1',
          accountingTransactionId: 'txn-1',
          state: MarketingClientBillingState.SUBMITTED,
        },
      ]);
      prisma.tx.marketingClientBilling.count.mockResolvedValue(1);
      prisma.tx.marketingClientProduct.findUnique.mockResolvedValue({
        id: 'cp-1',
        status: MarketingClientProductStatus.PENDING,
      });

      await service.listTransactions(viewer, 'client-1');

      expect(prisma.tx.marketingClientBilling.update).toHaveBeenCalledWith({
        where: { id: 'b-1' },
        data: { state: MarketingClientBillingState.POSTED },
      });
      expect(prisma.tx.marketingClientProduct.update).toHaveBeenCalledWith({
        where: { id: 'cp-1' },
        data: { status: MarketingClientProductStatus.PURCHASED },
      });
    });
  });

  describe('getSummary', () => {
    it('has no figures for a client with no entity yet', async () => {
      await expect(service.getSummary(viewer, 'client-1')).resolves.toEqual({
        currency: null,
        achievedRevenue: null,
        products: [],
      });
      expect(accounting.receiptsSummary).not.toHaveBeenCalled();
    });

    it('totals what accounting received, in total and per product', async () => {
      prisma.marketingClient.findFirst.mockResolvedValue({
        ...client,
        accountingEntityId: 'entity-1',
      });
      prisma.marketingClientBilling.findMany.mockResolvedValue([
        { accountingTransactionId: 'txn-1', productId: 'p-1' },
        { accountingTransactionId: 'txn-2', productId: 'p-1' },
        { accountingTransactionId: 'txn-3', productId: null },
      ]);
      accounting.receiptsSummary.mockResolvedValue({
        currency: 'GHS',
        entities: [{ entityId: 'entity-1', receivedAmount: '9000.5' }],
        transactions: [
          { transactionId: 'txn-1', receivedAmount: '5000' },
          { transactionId: 'txn-2', receivedAmount: '2500.25' },
          { transactionId: 'txn-3', receivedAmount: '100' },
        ],
      });

      const result = await service.getSummary(viewer, 'client-1');

      expect(accounting.receiptsSummary).toHaveBeenCalledWith(
        {
          tenantId: 'tenant-1',
          entityIds: ['entity-1'],
          transactionIds: ['txn-1', 'txn-2', 'txn-3'],
        },
        'user-1',
      );
      expect(result).toEqual({
        currency: 'GHS',
        achievedRevenue: '9000.50',
        products: [{ productId: 'p-1', achievedRevenue: '7500.25' }],
      });
    });
  });

  describe('totalsForEntities', () => {
    it('asks once for a whole page of clients', async () => {
      accounting.receiptsSummary.mockResolvedValue({
        currency: 'GHS',
        entities: [
          { entityId: 'e1', receivedAmount: '10' },
          { entityId: 'e2', receivedAmount: '2.5' },
        ],
        transactions: [],
      });

      const totals = await service.totalsForEntities(viewer, ['e1', 'e2']);

      expect(accounting.receiptsSummary).toHaveBeenCalledTimes(1);
      expect(totals.get('e1')).toBe('10.00');
      expect(totals.get('e2')).toBe('2.50');
    });

    it('does not call accounting for an empty page or when it is not configured', async () => {
      await service.totalsForEntities(viewer, []);
      accounting.isConfigured.mockReturnValue(false);
      await service.totalsForEntities(viewer, ['e1']);

      expect(accounting.receiptsSummary).not.toHaveBeenCalled();
    });

    it('returns nothing, rather than failing the list, when accounting is down', async () => {
      accounting.receiptsSummary.mockRejectedValue(new Error('down'));

      const totals = await service.totalsForEntities(viewer, ['e1']);

      expect(totals.size).toBe(0);
    });
  });

  describe('handleAccountingEvent', () => {
    const event = (overrides = {}) => ({
      tenantId: 'tenant-1',
      sourceModule: 'MARKETING',
      transactionId: 'txn-1',
      event: AccountingEvent.POSTED,
      ...overrides,
    });
    const row = (state: MarketingClientBillingState) => ({
      id: 'b-1',
      clientId: 'client-1',
      productId: 'p-1',
      state,
    });

    it('ignores events for other modules', async () => {
      await expect(
        service.handleAccountingEvent(event({ sourceModule: 'HR' })),
      ).resolves.toEqual({ handled: false });
      expect(prisma.marketingClientBilling.findUnique).not.toHaveBeenCalled();
    });

    it('ignores transactions marketing did not raise', async () => {
      await expect(service.handleAccountingEvent(event())).resolves.toEqual({
        handled: false,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('marks the product Purchased once its transaction is posted', async () => {
      prisma.marketingClientBilling.findUnique.mockResolvedValue(
        row(MarketingClientBillingState.SUBMITTED),
      );
      prisma.tx.marketingClientBilling.count.mockResolvedValue(1);
      prisma.tx.marketingClientProduct.findUnique.mockResolvedValue({
        id: 'cp-1',
        status: MarketingClientProductStatus.PENDING,
      });

      await expect(service.handleAccountingEvent(event())).resolves.toEqual({
        handled: true,
      });

      expect(prisma.tx.marketingClientBilling.update).toHaveBeenCalledWith({
        where: { id: 'b-1' },
        data: { state: MarketingClientBillingState.POSTED },
      });
      expect(prisma.tx.marketingClientProduct.update).toHaveBeenCalledWith({
        where: { id: 'cp-1' },
        data: { status: MarketingClientProductStatus.PURCHASED },
      });
    });

    it('moves the product back to Pending when its only posted transaction is reversed', async () => {
      prisma.marketingClientBilling.findUnique.mockResolvedValue(
        row(MarketingClientBillingState.POSTED),
      );
      prisma.tx.marketingClientBilling.count.mockResolvedValue(0);
      prisma.tx.marketingClientProduct.findUnique.mockResolvedValue({
        id: 'cp-1',
        status: MarketingClientProductStatus.PURCHASED,
      });

      await service.handleAccountingEvent(
        event({ event: AccountingEvent.REVERSED }),
      );

      expect(prisma.tx.marketingClientProduct.update).toHaveBeenCalledWith({
        where: { id: 'cp-1' },
        data: { status: MarketingClientProductStatus.PENDING },
      });
    });

    it('keeps the product Purchased while another posted transaction remains', async () => {
      prisma.marketingClientBilling.findUnique.mockResolvedValue(
        row(MarketingClientBillingState.POSTED),
      );
      prisma.tx.marketingClientBilling.count.mockResolvedValue(1);
      prisma.tx.marketingClientProduct.findUnique.mockResolvedValue({
        id: 'cp-1',
        status: MarketingClientProductStatus.PURCHASED,
      });

      await service.handleAccountingEvent(
        event({ event: AccountingEvent.REVERSED }),
      );

      expect(prisma.tx.marketingClientProduct.update).not.toHaveBeenCalled();
    });

    it('never overrides an Uninterested product', async () => {
      prisma.marketingClientBilling.findUnique.mockResolvedValue(
        row(MarketingClientBillingState.SUBMITTED),
      );
      prisma.tx.marketingClientBilling.count.mockResolvedValue(1);
      prisma.tx.marketingClientProduct.findUnique.mockResolvedValue({
        id: 'cp-1',
        status: MarketingClientProductStatus.UNINTERESTED,
      });

      await service.handleAccountingEvent(event());

      expect(prisma.tx.marketingClientProduct.update).not.toHaveBeenCalled();
    });

    it('records a rejection without touching the product', async () => {
      prisma.marketingClientBilling.findUnique.mockResolvedValue(
        row(MarketingClientBillingState.SUBMITTED),
      );
      prisma.tx.marketingClientBilling.count.mockResolvedValue(0);
      prisma.tx.marketingClientProduct.findUnique.mockResolvedValue({
        id: 'cp-1',
        status: MarketingClientProductStatus.PENDING,
      });

      await service.handleAccountingEvent(
        event({ event: AccountingEvent.REJECTED }),
      );

      expect(prisma.tx.marketingClientBilling.update).toHaveBeenCalledWith({
        where: { id: 'b-1' },
        data: { state: MarketingClientBillingState.REJECTED },
      });
      expect(prisma.tx.marketingClientProduct.update).not.toHaveBeenCalled();
    });
  });
});
