import { createHmac } from 'crypto';
import { Injectable } from '@nestjs/common';
import { AccountingSourceEventEnvelope } from './reinsurance-accounting-event.builder';

const SERVICE_NAME = 'reinsurance-service';
const ACCOUNTING_SOURCE_EVENTS_PATH = '/internal/source-events';
const ACCOUNTING_SUBLEDGER_ENSURE_PATH = '/internal/subledgers/ensure';

export interface AccountingSourceEventResponse {
  id: string;
  tenantId?: string;
  sourceModule?: string;
  sourceEventType?: string;
  sourceRecordId?: string;
  idempotencyKey?: string;
  status?: string;
}

export interface EnsureAccountingSubledgerRequest {
  tenantId: string;
  type: 'CEDANT' | 'REINSURER';
  externalRef: string;
  name: string;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface AccountingSubledgerResponse {
  id: string;
  tenantId?: string;
  code?: string;
  name?: string;
  type?: string;
  externalRef?: string;
  currency?: string;
  status?: string;
  controlAccount?: {
    id?: string;
    code?: string;
    name?: string;
  };
}

export class ReinsuranceAccountingClientError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ReinsuranceAccountingClientError';
  }
}

@Injectable()
export class ReinsuranceAccountingClient {
  async enqueueSourceEvent(
    envelope: AccountingSourceEventEnvelope,
  ): Promise<AccountingSourceEventResponse> {
    const body = await this.signedPost(ACCOUNTING_SOURCE_EVENTS_PATH, envelope);
    const eventId = this.extractEventId(body);
    if (!eventId) {
      throw new ReinsuranceAccountingClientError(
        'Accounting source-event response did not include an event id',
        false,
      );
    }

    return {
      id: eventId,
      tenantId: this.stringField(body, 'tenantId'),
      sourceModule: this.stringField(body, 'sourceModule'),
      sourceEventType: this.stringField(body, 'sourceEventType'),
      sourceRecordId: this.stringField(body, 'sourceRecordId'),
      idempotencyKey: this.stringField(body, 'idempotencyKey'),
      status: this.stringField(body, 'status'),
    };
  }

  async ensureSubledger(
    request: EnsureAccountingSubledgerRequest,
  ): Promise<AccountingSubledgerResponse> {
    const body = await this.signedPost(
      ACCOUNTING_SUBLEDGER_ENSURE_PATH,
      request,
    );
    const subledgerId = this.extractEventId(body);
    if (!subledgerId) {
      throw new ReinsuranceAccountingClientError(
        'Accounting subledger ensure response did not include a subledger id',
        false,
      );
    }

    return {
      id: subledgerId,
      tenantId: this.stringField(body, 'tenantId'),
      code: this.stringField(body, 'code'),
      name: this.stringField(body, 'name'),
      type: this.stringField(body, 'type'),
      externalRef: this.stringField(body, 'externalRef'),
      currency: this.stringField(body, 'currency'),
      status: this.stringField(body, 'status'),
      controlAccount: this.objectField(body, 'controlAccount'),
    };
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
      throw new ReinsuranceAccountingClientError(
        'ACCOUNTING_SERVICE_URL is not configured',
        false,
      );
    }
    try {
      new URL(baseUrl);
    } catch {
      throw new ReinsuranceAccountingClientError(
        'ACCOUNTING_SERVICE_URL is invalid',
        false,
      );
    }
    if (!secret || secret.length < 32) {
      throw new ReinsuranceAccountingClientError(
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
      throw new ReinsuranceAccountingClientError(
        `Accounting source-event delivery failed: ${reason}`,
        true,
      );
    }

    const body = await this.readJson(response);
    if (!response.ok) {
      throw new ReinsuranceAccountingClientError(
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
      if (response.ok) {
        throw new ReinsuranceAccountingClientError(
          'Accounting source-event response was not valid JSON',
          true,
        );
      }
      return null;
    }
  }

  private extractEventId(body: unknown): string | null {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return null;
    }
    const id = (body as Record<string, unknown>).id;
    return typeof id === 'string' && id.trim() ? id.trim() : null;
  }

  private stringField(body: unknown, field: string): string | undefined {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return undefined;
    }
    const value = (body as Record<string, unknown>)[field];
    return typeof value === 'string' ? value : undefined;
  }

  private objectField(
    body: unknown,
    field: string,
  ): AccountingSubledgerResponse['controlAccount'] {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return undefined;
    }
    const value = (body as Record<string, unknown>)[field];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return undefined;
    }
    return {
      id: this.stringField(value, 'id'),
      code: this.stringField(value, 'code'),
      name: this.stringField(value, 'name'),
    };
  }

  private errorMessage(body: unknown, statusCode: number): string {
    if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
      const message = (body as Record<string, unknown>).message;
      if (typeof message === 'string' && message.trim()) {
        return message.trim().slice(0, 1000);
      }
      if (Array.isArray(message)) {
        return message.join('; ').slice(0, 1000);
      }
    }
    return `Accounting source-event delivery failed with status ${statusCode}`;
  }
}
