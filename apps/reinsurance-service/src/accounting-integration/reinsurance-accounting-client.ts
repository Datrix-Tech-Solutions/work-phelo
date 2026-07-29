import { createHmac } from 'crypto';
import { Injectable } from '@nestjs/common';
import { AccountingSourceEventEnvelope } from './reinsurance-accounting-event.builder';

const SERVICE_NAME = 'reinsurance-service';
const ACCOUNTING_SOURCE_EVENTS_PATH = '/internal/source-events';

export interface AccountingSourceEventResponse {
  id: string;
  tenantId?: string;
  sourceModule?: string;
  sourceEventType?: string;
  sourceRecordId?: string;
  idempotencyKey?: string;
  status?: string;
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
    const baseUrl = process.env.ACCOUNTING_SERVICE_URL?.trim().replace(
      /\/+$/,
      '',
    );
    const secret = process.env.INTERNAL_SERVICE_AUTH_SECRET?.trim();
    if (!baseUrl || !secret || secret.length < 32) {
      throw new ReinsuranceAccountingClientError(
        'Accounting source-event service is not configured',
        false,
      );
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', secret)
      .update(
        `${SERVICE_NAME}:${timestamp}:POST:${ACCOUNTING_SOURCE_EVENTS_PATH}`,
      )
      .digest('hex');

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${ACCOUNTING_SOURCE_EVENTS_PATH}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-workphelo-service': SERVICE_NAME,
          'x-workphelo-timestamp': timestamp,
          'x-workphelo-signature': signature,
        },
        body: JSON.stringify(envelope),
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

    const eventId = this.extractEventId(body);
    if (!eventId) {
      throw new ReinsuranceAccountingClientError(
        'Accounting source-event response did not include an event id',
        false,
        response.status,
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
