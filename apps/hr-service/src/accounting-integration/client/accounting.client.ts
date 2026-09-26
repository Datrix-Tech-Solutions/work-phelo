import { createHmac } from 'crypto';
import { Injectable } from '@nestjs/common';

const SERVICE_NAME = 'hr-service';
const POST_ACCRUAL_PATH = '/internal/payroll-integration/post-accrual';

export interface PostPayrollAccrualRequest {
  tenantId: string;
  payrollRunId: string;
  periodLabel: string;
  transactionDate: string;
  totalGross: number;
  totalNet: number;
  totalPAYE: number;
  totalTier1: number;
  totalTier2: number;
  totalTier3: number;
  totalEmployerCost: number;
  totalOtherDeductions: number;
  autoPost: boolean;
}

export class HrAccountingClientError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'HrAccountingClientError';
  }
}

/** Calls accounting-service's internal (service-to-service, HMAC-signed) endpoints — never
 *  used from a request a browser is waiting on; this is for backend-triggered side effects
 *  like posting payroll's accrual journal on approval. Mirrors
 *  apps/reinsurance-service/src/accounting-integration/client/accounting.client.ts. */
@Injectable()
export class HrAccountingClient {
  async postPayrollAccrual(
    payload: PostPayrollAccrualRequest,
  ): Promise<unknown> {
    return this.signedPost(POST_ACCRUAL_PATH, payload);
  }

  configurationStatus() {
    const baseUrl = process.env.ACCOUNTING_SERVICE_URL?.trim().replace(
      /\/+$/,
      '',
    );
    const secret = process.env.INTERNAL_SERVICE_AUTH_SECRET?.trim();
    return {
      configured: Boolean(baseUrl && secret && secret.length >= 32),
      baseUrlConfigured: Boolean(baseUrl),
      serviceAuthSecretConfigured: Boolean(secret && secret.length >= 32),
    };
  }

  private async signedPost(path: string, payload: object): Promise<unknown> {
    const baseUrl = process.env.ACCOUNTING_SERVICE_URL?.trim().replace(
      /\/+$/,
      '',
    );
    const secret = process.env.INTERNAL_SERVICE_AUTH_SECRET?.trim();
    if (!baseUrl) {
      throw new HrAccountingClientError(
        'ACCOUNTING_SERVICE_URL is not configured',
        false,
      );
    }
    try {
      new URL(baseUrl);
    } catch {
      throw new HrAccountingClientError(
        'ACCOUNTING_SERVICE_URL is invalid',
        false,
      );
    }
    if (!secret || secret.length < 32) {
      throw new HrAccountingClientError(
        'INTERNAL_SERVICE_AUTH_SECRET is not configured or shorter than 32 characters',
        false,
      );
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', secret)
      .update(`${SERVICE_NAME}:${timestamp}:POST:${path}`)
      .digest('hex');

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-workphelo-service': SERVICE_NAME,
          'x-workphelo-timestamp': timestamp,
          'x-workphelo-signature': signature,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs()),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new HrAccountingClientError(
        `Accounting payroll-accrual delivery failed: ${reason}`,
        true,
      );
    }

    const body = await this.readJson(response);
    if (!response.ok) {
      throw new HrAccountingClientError(
        this.errorMessage(body, response.status),
        response.status >= 500 ||
          response.status === 408 ||
          response.status === 429,
        response.status,
      );
    }
    return body;
  }

  private timeoutMs(): number {
    const parsed = Number(process.env.ACCOUNTING_SERVICE_TIMEOUT_MS);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 10000;
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  private errorMessage(body: unknown, statusCode: number): string {
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message?: unknown }).message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.join(', ');
    }
    return `Accounting service responded with status ${statusCode}`;
  }
}
