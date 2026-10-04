import { Injectable } from '@nestjs/common';
import { InternalServiceClient } from '@work-phelo/internal-auth';

/** Which module a transaction is raised for. Accounting treats this as a parameter, not a constant. */
export const SOURCE_MODULE = 'MARKETING';

export interface BillingEntityType {
  id: string;
  name: string;
}

export interface BillingTransactionType {
  id: string;
  name: string;
  /** Entity types this transaction type may be used with. */
  entityTypeIds: string[];
}

export interface AccountingBillingOptions {
  ready: boolean;
  /** Why it is not ready, when it is not. */
  reason?: string;
  baseCurrency?: string;
  entityTypes: BillingEntityType[];
  transactionTypes: BillingTransactionType[];
}

export interface CreateSourceTransactionInput {
  tenantId: string;
  /** Stable per submission, so a retry never creates a second transaction. */
  idempotencyKey: string;
  /** The client's id, which Accounting stores against the entity it creates. */
  externalRef: string;
  entityName: string;
  /** First transaction only - Accounting creates the entity under this type. */
  entityTypeId?: string;
  /** Later transactions - the entity Accounting returned for the first one. */
  entityId?: string;
  transactionTypeId: string;
  amount: number;
  description?: string;
}

export interface SourceTransactionCreated {
  entityId: string;
  /** The type the entity sits under, so later forms can offer only matching transaction types. */
  entityTypeId: string;
  transactionId: string;
  state: string;
}

/** One payment against an invoice: a request waiting on the accountant, or money received. */
export interface InvoicePayment {
  id: string;
  kind: 'PAYMENT_REQUEST' | 'RECEIPT';
  /** PENDING, POSTED (received), REVERSED, REJECTED or CANCELLED. */
  state: string;
  stateLabel: string;
  amount: string;
  currency: string;
  paymentDate: string;
  reference: string | null;
  requestedByName: string | null;
  /** Why it was rejected (or reversed), when it was. */
  reason: string | null;
  createdAt: string;
}

/** What only an invoice carries. */
export interface InvoiceBalanceFields {
  outstandingAmount: string;
  pendingAmount: string;
  /** What a new payment request may still ask for: owed, less requests already waiting. */
  claimableAmount: string;
  canRequestPayment: boolean;
  payments: InvoicePayment[];
}

export interface SourceTransactionItem extends Partial<InvoiceBalanceFields> {
  id: string;
  kind: 'INVOICE' | 'CREDIT_NOTE' | 'RECEIPT' | 'CASHBOOK';
  /** Machine code: DRAFT, POSTED, REVERSED, REJECTED, ... */
  state: string;
  stateLabel: string;
  amount: string;
  currency: string;
  transactionTypeName: string;
  documentNumber: string | null;
  /** Why it was rejected, when it was. */
  reason: string | null;
  receivedAmount: string;
  createdAt: string;
}

export interface SourceTransactionsPage {
  items: SourceTransactionItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ReceiptsSummary {
  currency: string;
  entities: { entityId: string; receivedAmount: string }[];
  /** Received per transaction, for the transaction ids that were asked about. */
  transactions: { transactionId: string; receivedAmount: string }[];
}

export interface CreatePaymentRequestInput {
  tenantId: string;
  /** Stable per submission, so a retry never raises a second request. */
  idempotencyKey: string;
  /** The client's id - Accounting checks the invoice belongs to this client's entity. */
  externalRef: string;
  invoiceId: string;
  amount: number;
  /** YYYY-MM-DD, not in the future. */
  paymentDate: string;
  reference?: string;
  note?: string;
  requestedByName?: string;
}

export interface PaymentRequestResult {
  id: string;
  status: string;
  amount: string;
}

const BASE = '/internal/source-transactions';

/**
 * Typed wrapper over accounting-service's internal source-transaction routes. Marketing only
 * tells Accounting about a transaction; Accounting creates the entity and the draft, and owns
 * everything that happens to it afterwards.
 */
@Injectable()
export class AccountingClient {
  private readonly http = new InternalServiceClient({
    serviceName: 'marketing-service',
    targetName: 'accounting-service',
    baseUrl: process.env.ACCOUNTING_SERVICE_URL,
    timeoutMs: Number(process.env.ACCOUNTING_SERVICE_TIMEOUT_MS),
  });

  isConfigured() {
    return this.http.isConfigured();
  }

  getOptions(tenantId: string, actingUserId: string) {
    return this.http.get<AccountingBillingOptions>(`${BASE}/options`, {
      query: { tenantId, sourceModule: SOURCE_MODULE },
      actingUserId,
    });
  }

  createTransaction(input: CreateSourceTransactionInput, actingUserId: string) {
    return this.http.post<SourceTransactionCreated>(BASE, {
      body: { ...input, sourceModule: SOURCE_MODULE },
      actingUserId,
    });
  }

  listTransactions(
    tenantId: string,
    entityId: string,
    paging: { page?: number; limit?: number },
    actingUserId: string,
  ) {
    return this.http.get<SourceTransactionsPage>(BASE, {
      query: {
        tenantId,
        sourceModule: SOURCE_MODULE,
        entityId,
        page: paging.page,
        limit: paging.limit,
      },
      actingUserId,
    });
  }

  receiptsSummary(
    input: { tenantId: string; entityIds: string[]; transactionIds?: string[] },
    actingUserId: string,
  ) {
    return this.http.post<ReceiptsSummary>(`${BASE}/receipts-summary`, {
      body: { ...input, sourceModule: SOURCE_MODULE },
      actingUserId,
    });
  }

  createPaymentRequest(input: CreatePaymentRequestInput, actingUserId: string) {
    return this.http.post<PaymentRequestResult>(`${BASE}/payment-requests`, {
      body: { ...input, sourceModule: SOURCE_MODULE },
      actingUserId,
    });
  }

  cancelPaymentRequest(
    input: { tenantId: string; requestId: string; externalRef: string },
    actingUserId: string,
  ) {
    return this.http.post<{ id: string; status: string }>(
      `${BASE}/payment-requests/${encodeURIComponent(input.requestId)}/cancel`,
      {
        body: {
          tenantId: input.tenantId,
          externalRef: input.externalRef,
          sourceModule: SOURCE_MODULE,
        },
        actingUserId,
      },
    );
  }
}
