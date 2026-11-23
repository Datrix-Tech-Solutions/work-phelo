import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  InternalServiceClient,
  InternalServiceClientError,
} from '@work-phelo/internal-auth';

/** The Accounting source project invoices are raised under. */
export const PROJECTS_SOURCE_MODULE = 'PROJECTS';

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

export interface CreateProjectTransactionInput {
  tenantId: string;
  /** Stable per submission, so a retry never creates a second transaction. */
  idempotencyKey: string;
  /** The project client's id, which Accounting stores against the entity it creates. */
  externalRef: string;
  entityName: string;
  /** First invoice for the client: Accounting creates the entity under this type. */
  entityTypeId?: string;
  /** Later invoices: the entity Accounting returned for the first one. */
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
 * Typed wrapper over accounting-service's source-transaction routes, for invoices raised to project
 * clients. Project management only tells Accounting about an invoice; Accounting creates the entity
 * and the draft and owns everything that happens to it afterwards.
 */
@Injectable()
export class ProjectAccountingClient {
  private readonly logger = new Logger(ProjectAccountingClient.name);
  private readonly http = new InternalServiceClient({
    serviceName: 'hr-service',
    targetName: 'accounting-service',
    baseUrl: process.env.ACCOUNTING_SERVICE_URL,
    timeoutMs: Number(process.env.ACCOUNTING_SERVICE_TIMEOUT_MS),
  });

  isConfigured() {
    return this.http.isConfigured();
  }

  getOptions(tenantId: string, actingUserId: string) {
    return this.call(() =>
      this.http.get<AccountingBillingOptions>(`${BASE}/options`, {
        query: { tenantId, sourceModule: PROJECTS_SOURCE_MODULE },
        actingUserId,
      }),
    );
  }

  createTransaction(
    input: CreateProjectTransactionInput,
    actingUserId: string,
  ) {
    return this.call(() =>
      this.http.post<SourceTransactionCreated>(BASE, {
        body: { ...input, sourceModule: PROJECTS_SOURCE_MODULE },
        actingUserId,
      }),
    );
  }

  /**
   * Accounting's own validation errors (4xx) pass through so the user sees why; outages and
   * service-auth problems become a 502 that says Accounting is unavailable.
   */
  private async call<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (!(error instanceof InternalServiceClientError)) throw error;
      const status = error.statusCode;
      if (
        status !== undefined &&
        status >= 400 &&
        status < 500 &&
        ![401, 403, 408, 429].includes(status)
      ) {
        throw new HttpException(error.message, status);
      }
      this.logger.error(`accounting-service call failed: ${error.message}`);
      throw new BadGatewayException(
        'Accounting is temporarily unavailable. Please try again.',
      );
    }
  }
}
