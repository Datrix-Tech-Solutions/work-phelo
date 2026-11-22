import { Injectable } from '@nestjs/common';
import { InternalServiceClient } from '@work-phelo/internal-auth';

/** Which module a transaction is raised for. Accounting treats this as a parameter, not a constant. */
export const SOURCE_MODULE = 'OPERATIONS';

export interface AccountingPaymentOptions {
  ready: boolean;
  /** Why it is not ready, when it is not. */
  reason?: string;
  baseCurrency?: string;
  entityTypes: { id: string; name: string }[];
  transactionTypes: { id: string; name: string; entityTypeIds: string[] }[];
}

export interface CreateSourceTransactionInput {
  tenantId: string;
  /** Stable per payment, so a retry never raises a second transaction. */
  idempotencyKey: string;
  /** The supplier's id, which Accounting stores against the entity it creates. */
  externalRef: string;
  entityName: string;
  /** First payment to the supplier only - Accounting creates the entity under this type. */
  entityTypeId?: string;
  /** Later payments - the entity Accounting returned for the first one. */
  entityId?: string;
  transactionTypeId: string;
  amount: number;
  description?: string;
}

export interface SourceTransactionCreated {
  entityId: string;
  entityTypeId: string;
  transactionId: string;
  state: string;
}

const BASE = '/internal/source-transactions';

/**
 * Typed wrapper over accounting-service's internal source-transaction routes. Inventory only tells
 * Accounting about a payment to a supplier; Accounting creates the supplier entity and the draft
 * payment, and owns everything that happens to it afterwards.
 */
@Injectable()
export class AccountingClient {
  private readonly http = new InternalServiceClient({
    serviceName: 'inventory-service',
    targetName: 'accounting-service',
    baseUrl: process.env.ACCOUNTING_SERVICE_URL,
    timeoutMs: Number(process.env.ACCOUNTING_SERVICE_TIMEOUT_MS),
  });

  isConfigured() {
    return this.http.isConfigured();
  }

  getOptions(tenantId: string, actingUserId: string) {
    return this.http.get<AccountingPaymentOptions>(`${BASE}/options`, {
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
}
