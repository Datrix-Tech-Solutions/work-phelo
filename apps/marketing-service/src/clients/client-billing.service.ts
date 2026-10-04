import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { InternalServiceClientError } from '@work-phelo/internal-auth';
import {
  MarketingClientBillingState,
  MarketingClientProductStatus,
  Prisma,
} from '../../prisma/generated/client';
import {
  AccountingClient,
  SourceTransactionCreated,
} from '../accounting/accounting.client';
import { callAccounting } from '../accounting/call-accounting';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccountingEvent,
  AccountingEventDto,
  QueryClientBillingDto,
  RaiseClientBillingDto,
  RequestClientPaymentDto,
} from './dto/billing.dto';

const SOURCE_MODULE = 'MARKETING';
const NO_PERMISSION_MESSAGE = "You don't have permission to bill clients.";
const ENTITY_TYPE_REQUIRED_MESSAGE =
  'An entity type is required for the first transaction of a client.';
const INVALID_PRODUCT_MESSAGE =
  'The product must be one of this client’s products, and not an uninterested one.';
const NOT_BILLED_MESSAGE =
  'This client has not been billed yet, so there is no invoice to pay.';
const SEND_PAYMENT_FAILED_MESSAGE =
  'Accounting could not be reached, so the payment request was not sent. Please try again.';
const SEND_FAILED_MESSAGE =
  'Accounting could not be reached, so nothing was created. Please try again.';

/** Shown on the Billable toggle when billing cannot be used. */
export type BillingNotReadyReason =
  | 'NOT_CONFIGURED'
  | 'NOT_SET_UP'
  | 'UNAVAILABLE';

export interface BillingSubmission {
  tenantId: string;
  clientId: string;
  clientName: string;
  /** Present once the client has an entity in Accounting. */
  entityId: string | null;
  entityTypeId?: string;
  transactionTypeId: string;
  amount: number;
  description?: string;
  productId?: string;
  idempotencyKey: string;
}

type Tx = Prisma.TransactionClient;

@Injectable()
export class ClientBillingService {
  private readonly logger = new Logger(ClientBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingClient,
  ) {}

  canBill(user: RequestUser): boolean {
    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN')
      return true;
    return user.permissions.includes(
      MarketingCrmSettingsPermission.CLIENTS_BILLING_CREATE,
    );
  }

  assertCanBill(user: RequestUser) {
    if (!this.canBill(user))
      throw new ForbiddenException(NO_PERMISSION_MESSAGE);
  }

  /** What the Billable toggle and billing form need. Never throws - "not ready" is an answer. */
  async getOptions(user: RequestUser) {
    const canBill = this.canBill(user);
    const notReady = (reason: BillingNotReadyReason, detail?: string) => ({
      canBill,
      ready: false,
      reason,
      message:
        reason === 'UNAVAILABLE'
          ? 'Accounting is currently unavailable'
          : 'Accounting not set up',
      detail: detail ?? null,
      baseCurrency: null,
      entityTypes: [],
      transactionTypes: [],
    });

    if (!this.accounting.isConfigured()) return notReady('NOT_CONFIGURED');

    try {
      const options = await this.accounting.getOptions(user.tenantId, user.id);
      if (
        !options.ready ||
        options.entityTypes.length === 0 ||
        options.transactionTypes.length === 0
      ) {
        return notReady('NOT_SET_UP', options.reason);
      }
      return {
        canBill,
        ready: true,
        reason: null,
        message: null,
        detail: null,
        baseCurrency: options.baseCurrency ?? null,
        entityTypes: options.entityTypes,
        transactionTypes: options.transactionTypes,
      };
    } catch (error) {
      if (error instanceof InternalServiceClientError) {
        // A 4xx means Accounting answered but this tenant has nothing to bill with; anything
        // else means we could not get an answer.
        const answered =
          error.statusCode !== undefined &&
          error.statusCode >= 400 &&
          error.statusCode < 500 &&
          ![401, 403, 408, 429].includes(error.statusCode);
        this.logger.warn(`billing options unavailable: ${error.message}`);
        return notReady(answered ? 'NOT_SET_UP' : 'UNAVAILABLE', error.message);
      }
      throw error;
    }
  }

  /** Sends the transaction to Accounting. Accounting creates the entity (first time) and the draft. */
  async submit(
    user: RequestUser,
    input: BillingSubmission,
  ): Promise<SourceTransactionCreated> {
    this.assertCanBill(user);
    if (!input.entityId && !input.entityTypeId) {
      throw new BadRequestException(ENTITY_TYPE_REQUIRED_MESSAGE);
    }

    return callAccounting(
      this.logger,
      () =>
        this.accounting.createTransaction(
          {
            tenantId: input.tenantId,
            idempotencyKey: input.idempotencyKey,
            externalRef: input.clientId,
            entityName: input.clientName,
            ...(input.entityId
              ? { entityId: input.entityId }
              : { entityTypeId: input.entityTypeId }),
            transactionTypeId: input.transactionTypeId,
            amount: input.amount,
            ...(input.description ? { description: input.description } : {}),
          },
          user.id,
        ),
      SEND_FAILED_MESSAGE,
    );
  }

  /** Records, inside the caller's transaction, that this Accounting transaction is the client's. */
  async record(
    tx: Tx,
    user: RequestUser,
    input: {
      clientId: string;
      productId?: string;
      transactionId: string;
      state: string;
      amount: number;
      idempotencyKey: string;
    },
  ) {
    const existing = await tx.marketingClientBilling.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: user.tenantId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return existing;

    return tx.marketingClientBilling.create({
      data: {
        tenantId: user.tenantId,
        clientId: input.clientId,
        productId: input.productId ?? null,
        accountingTransactionId: input.transactionId,
        idempotencyKey: input.idempotencyKey,
        state: this.toBillingState(input.state),
        amount: input.amount,
        createdByUserId: user.id,
      },
    });
  }

  /** A client's next transaction (the first one included, for a client created without billing). */
  async raise(user: RequestUser, clientId: string, dto: RaiseClientBillingDto) {
    this.assertCanBill(user);
    const client = await this.findVisibleClient(user, clientId);

    if (dto.productId) {
      const product = client.products.find(
        (p) => p.productId === dto.productId,
      );
      if (
        !product ||
        product.status === MarketingClientProductStatus.UNINTERESTED
      ) {
        throw new BadRequestException(INVALID_PRODUCT_MESSAGE);
      }
    }

    const idempotencyKey = `client-billing:${client.id}:${dto.submissionId}`;
    const existing = await this.prisma.marketingClientBilling.findUnique({
      where: {
        tenantId_idempotencyKey: { tenantId: user.tenantId, idempotencyKey },
      },
    });
    if (existing) return this.toRaiseResponse(existing);

    const created = await this.submit(user, {
      tenantId: user.tenantId,
      clientId: client.id,
      clientName: client.companyName,
      entityId: client.accountingEntityId,
      entityTypeId: dto.entityTypeId,
      transactionTypeId: dto.transactionTypeId,
      amount: dto.amount,
      description: dto.description,
      productId: dto.productId,
      idempotencyKey,
    });

    const row = await this.prisma.$transaction(async (tx) => {
      // Billing is only ever switched on by raising a transaction, never by a plain edit.
      await tx.marketingClient.update({
        where: { id: client.id },
        data: {
          isBillable: true,
          updatedByUserId: user.id,
          ...(client.accountingEntityId
            ? {}
            : {
                accountingEntityId: created.entityId,
                accountingEntityTypeId: created.entityTypeId,
              }),
        },
      });
      return this.record(tx, user, {
        clientId: client.id,
        productId: dto.productId,
        transactionId: created.transactionId,
        state: created.state,
        amount: dto.amount,
        idempotencyKey,
      });
    });

    return this.toRaiseResponse(row);
  }

  /**
   * The client has paid (part of) a posted invoice: asks Accounting to record it. Accounting
   * confirms through its own Receive Payment, choosing the bank, or rejects it. Nothing is
   * stored here - the request and its outcome are read back from Accounting.
   */
  async requestPayment(
    user: RequestUser,
    clientId: string,
    dto: RequestClientPaymentDto,
  ) {
    this.assertCanBill(user);
    const client = await this.findVisibleClient(user, clientId);
    if (!client.accountingEntityId) {
      throw new BadRequestException(NOT_BILLED_MESSAGE);
    }

    return callAccounting(
      this.logger,
      () =>
        this.accounting.createPaymentRequest(
          {
            tenantId: user.tenantId,
            idempotencyKey: `client-payment:${client.id}:${dto.submissionId}`,
            externalRef: client.id,
            invoiceId: dto.invoiceId,
            amount: dto.amount,
            paymentDate: dto.paymentDate,
            ...(dto.reference ? { reference: dto.reference } : {}),
            ...(dto.note ? { note: dto.note } : {}),
            ...(user.firstName ? { requestedByName: user.firstName } : {}),
          },
          user.id,
        ),
      SEND_PAYMENT_FAILED_MESSAGE,
    );
  }

  /** Withdraws a payment request that Accounting has not acted on yet. */
  async cancelPayment(user: RequestUser, clientId: string, requestId: string) {
    this.assertCanBill(user);
    const client = await this.findVisibleClient(user, clientId);

    return callAccounting(this.logger, () =>
      this.accounting.cancelPaymentRequest(
        { tenantId: user.tenantId, requestId, externalRef: client.id },
        user.id,
      ),
    );
  }

  /** The client's transactions, with their state read live from Accounting. */
  async listTransactions(
    user: RequestUser,
    clientId: string,
    query: QueryClientBillingDto = {},
  ) {
    const client = await this.findVisibleClient(user, clientId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (!client.accountingEntityId) {
      return {
        items: [],
        meta: { page, limit, total: 0, totalPages: 1 },
      };
    }
    const entityId = client.accountingEntityId;

    const result = await callAccounting(this.logger, () =>
      this.accounting.listTransactions(
        user.tenantId,
        entityId,
        { page, limit },
        user.id,
      ),
    );

    const rows = await this.prisma.marketingClientBilling.findMany({
      where: {
        tenantId: user.tenantId,
        clientId: client.id,
        accountingTransactionId: { in: result.items.map((item) => item.id) },
      },
    });
    const rowByTransaction = new Map(
      rows.map((row) => [row.accountingTransactionId, row]),
    );

    // Accounting is the source of truth. If a notification never reached us, this heals the
    // stored state (and so the product status) the next time anyone looks.
    await this.reconcile(
      user.tenantId,
      client.id,
      result.items,
      rowByTransaction,
    );

    const productNames = await this.productNames(
      user.tenantId,
      rows.map((row) => row.productId),
    );

    return {
      items: result.items.map((item) => {
        const row = rowByTransaction.get(item.id);
        return {
          ...item,
          productId: row?.productId ?? null,
          productName: row?.productId
            ? (productNames.get(row.productId) ?? null)
            : null,
          raisedFromMarketing: Boolean(row),
        };
      }),
      meta: result.meta,
    };
  }

  /** Achieved revenue: what Accounting has received, for the client and per product. */
  async getSummary(user: RequestUser, clientId: string) {
    const client = await this.findVisibleClient(user, clientId);
    if (!client.accountingEntityId) {
      return { currency: null, achievedRevenue: null, products: [] };
    }
    const entityId = client.accountingEntityId;

    const rows = await this.prisma.marketingClientBilling.findMany({
      where: { tenantId: user.tenantId, clientId: client.id },
      select: { accountingTransactionId: true, productId: true },
    });

    const summary = await callAccounting(this.logger, () =>
      this.accounting.receiptsSummary(
        {
          tenantId: user.tenantId,
          entityIds: [entityId],
          transactionIds: rows.map((row) => row.accountingTransactionId),
        },
        user.id,
      ),
    );

    const receivedByTransaction = new Map(
      summary.transactions.map((t) => [
        t.transactionId,
        new Prisma.Decimal(t.receivedAmount),
      ]),
    );
    const byProduct = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      if (!row.productId) continue;
      const received = receivedByTransaction.get(row.accountingTransactionId);
      if (!received) continue;
      byProduct.set(
        row.productId,
        (byProduct.get(row.productId) ?? new Prisma.Decimal(0)).plus(received),
      );
    }

    const total = summary.entities.find(
      (e) => e.entityId === entityId,
    )?.receivedAmount;
    return {
      currency: summary.currency,
      achievedRevenue:
        total !== undefined ? new Prisma.Decimal(total).toFixed(2) : null,
      products: [...byProduct.entries()].map(([productId, amount]) => ({
        productId,
        achievedRevenue: amount.toFixed(2),
      })),
    };
  }

  /** Achieved revenue for a page of clients in one call. Never throws: a card just shows "—". */
  async totalsForEntities(
    user: RequestUser,
    entityIds: string[],
  ): Promise<Map<string, string>> {
    const totals = new Map<string, string>();
    if (entityIds.length === 0 || !this.accounting.isConfigured())
      return totals;
    try {
      const summary = await this.accounting.receiptsSummary(
        { tenantId: user.tenantId, entityIds },
        user.id,
      );
      for (const entity of summary.entities) {
        totals.set(
          entity.entityId,
          new Prisma.Decimal(entity.receivedAmount).toFixed(2),
        );
      }
    } catch (error) {
      this.logger.warn(
        `achieved revenue unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
    return totals;
  }

  /** Accounting tells us a transaction was posted, reversed or rejected. Safe to repeat. */
  async handleAccountingEvent(
    dto: AccountingEventDto,
  ): Promise<{ handled: boolean }> {
    if (dto.sourceModule !== SOURCE_MODULE) return { handled: false };

    const row = await this.prisma.marketingClientBilling.findUnique({
      where: {
        tenantId_accountingTransactionId: {
          tenantId: dto.tenantId,
          accountingTransactionId: dto.transactionId,
        },
      },
    });
    if (!row) return { handled: false };

    await this.applyState(dto.tenantId, row, this.eventToState(dto.event));
    return { handled: true };
  }

  private async reconcile(
    tenantId: string,
    clientId: string,
    items: Array<{ id: string; state: string }>,
    rowByTransaction: Map<
      string,
      {
        id: string;
        productId: string | null;
        state: MarketingClientBillingState;
      }
    >,
  ) {
    for (const item of items) {
      const row = rowByTransaction.get(item.id);
      if (!row) continue;
      const state = this.toBillingState(item.state);
      if (state !== row.state) {
        await this.applyState(tenantId, { ...row, clientId }, state);
      }
    }
  }

  private async applyState(
    tenantId: string,
    row: { id: string; clientId: string; productId: string | null },
    state: MarketingClientBillingState,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.marketingClientBilling.update({
        where: { id: row.id },
        data: { state },
      });
      await this.recomputeProductStatus(
        tx,
        tenantId,
        row.clientId,
        row.productId,
      );
    });
  }

  /**
   * A product is Purchased while at least one posted transaction was raised for it, and goes
   * back to Pending when none is left (a reversal). It never overrides Uninterested.
   */
  private async recomputeProductStatus(
    tx: Tx,
    tenantId: string,
    clientId: string,
    productId: string | null,
  ) {
    if (!productId) return;
    const [posted, product] = await Promise.all([
      tx.marketingClientBilling.count({
        where: {
          tenantId,
          clientId,
          productId,
          state: MarketingClientBillingState.POSTED,
        },
      }),
      tx.marketingClientProduct.findUnique({
        where: { clientId_productId: { clientId, productId } },
      }),
    ]);
    if (!product) return;

    if (posted > 0 && product.status === MarketingClientProductStatus.PENDING) {
      await tx.marketingClientProduct.update({
        where: { id: product.id },
        data: { status: MarketingClientProductStatus.PURCHASED },
      });
    } else if (
      posted === 0 &&
      product.status === MarketingClientProductStatus.PURCHASED
    ) {
      await tx.marketingClientProduct.update({
        where: { id: product.id },
        data: { status: MarketingClientProductStatus.PENDING },
      });
    }
  }

  private async findVisibleClient(user: RequestUser, id: string) {
    const canViewAll =
      user.role === 'SUPER_ADMIN' ||
      user.role === 'TENANT_ADMIN' ||
      user.permissions.includes(
        MarketingCrmSettingsPermission.CLIENTS_VIEW_ALL,
      );
    const client = await this.prisma.marketingClient.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ...(canViewAll ? {} : { assignedUserId: user.id }),
      },
      select: {
        id: true,
        companyName: true,
        accountingEntityId: true,
        products: { select: { productId: true, status: true } },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  private async productNames(tenantId: string, ids: Array<string | null>) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map<string, string>();
    const settings = await this.prisma.marketingCrmSettingOption.findMany({
      where: { tenantId, id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(settings.map((setting) => [setting.id, setting.name]));
  }

  private toRaiseResponse(row: {
    id: string;
    accountingTransactionId: string;
    state: MarketingClientBillingState;
  }) {
    return {
      id: row.id,
      accountingTransactionId: row.accountingTransactionId,
      state: row.state,
    };
  }

  private toBillingState(code: string): MarketingClientBillingState {
    switch (code.toUpperCase()) {
      case 'POSTED':
        return MarketingClientBillingState.POSTED;
      case 'REVERSED':
        return MarketingClientBillingState.REVERSED;
      case 'REJECTED':
        return MarketingClientBillingState.REJECTED;
      default:
        return MarketingClientBillingState.SUBMITTED;
    }
  }

  private eventToState(event: AccountingEvent): MarketingClientBillingState {
    return this.toBillingState(event);
  }
}
