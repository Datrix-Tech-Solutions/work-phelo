import { Injectable, Logger } from '@nestjs/common';
import type {
  SmsProvider,
  SmsSenderIdentityProviderResult,
  SmsSenderIdentityStatusInput,
  SmsSenderIdentitySubmissionInput,
  SmsSendOptions,
  SmsSendResult,
} from './sms-provider.interface';

@Injectable()
export class TermiiSmsProvider implements SmsProvider {
  readonly provider = 'termii' as const;
  readonly senderIdentityCapabilities = {
    submitSenderIdentity: true,
    refreshSenderIdentityStatus: true,
  };
  private readonly logger = new Logger(TermiiSmsProvider.name);
  private readonly apiKey = process.env.TERMII_API_KEY;
  private readonly senderId = process.env.TERMII_SENDER_ID || 'WorkPhelo';
  private readonly baseUrl = 'https://api.ng.termii.com/api';

  async sendMessage(
    to: string,
    message: string,
    options?: SmsSendOptions,
  ): Promise<SmsSendResult> {
    if (!this.apiKey) {
      return {
        success: false,
        status: 'FAILED',
        provider: this.provider,
        error: 'TERMII_API_KEY is required',
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          from: options?.senderId || this.senderId,
          sms: message,
          type: 'plain',
          api_key: this.apiKey,
          channel: 'generic',
        }),
      });

      const data = await this.safeJson(response);
      const providerStatus =
        data && typeof data === 'object' && 'code' in data
          ? String(data.code)
          : undefined;
      const providerDetail =
        data && typeof data === 'object' && 'message' in data
          ? String(data.message)
          : undefined;

      if (!response.ok || providerStatus !== 'ok') {
        this.logger.error(
          `Termii SMS failed for ${to}: ${JSON.stringify(data)}`,
        );
        return {
          success: false,
          status: 'FAILED',
          provider: this.provider,
          providerStatus,
          providerDetail,
          error: providerDetail ?? 'Termii SMS failed',
        };
      }

      return {
        success: true,
        status: 'SENT',
        provider: this.provider,
        providerStatus,
        providerDetail,
      };
    } catch (error) {
      this.logger.error(`Failed to send Termii SMS to ${to}`, error);
      return {
        success: false,
        status: 'FAILED',
        provider: this.provider,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async submitSenderIdentity(
    input: SmsSenderIdentitySubmissionInput,
  ): Promise<SmsSenderIdentityProviderResult> {
    if (!this.apiKey) throw new Error('TERMII_API_KEY is required');
    const purpose = input.purpose.trim();
    if (purpose.length < 10) {
      throw new Error('Sender purpose must be at least 10 characters');
    }

    const response = await fetch(`${this.baseUrl}/sender-id/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.apiKey,
        sender_id: input.senderId,
        usecase: purpose,
        company:
          input.tenantDomain || input.senderId || input.tenantId || 'WorkPhelo',
      }),
    });
    const data = await this.safeJson(response);
    if (!response.ok || this.isTermiiError(data)) {
      throw new Error(
        this.providerDetail(data) ||
          `Termii sender request failed with HTTP ${response.status}`,
      );
    }
    return this.senderResult(data, input.senderId, 'SUBMITTED');
  }

  async getSenderIdentityStatus(
    input: SmsSenderIdentityStatusInput,
  ): Promise<SmsSenderIdentityProviderResult> {
    if (!this.apiKey) throw new Error('TERMII_API_KEY is required');
    const url = new URL(`${this.baseUrl}/sender-id`);
    url.searchParams.set('api_key', this.apiKey);
    const response = await fetch(url);
    const data = await this.safeJson(response);
    if (!response.ok || this.isTermiiError(data)) {
      throw new Error(
        this.providerDetail(data) ||
          `Termii sender status lookup failed with HTTP ${response.status}`,
      );
    }
    const match = this.findSender(data, input.senderId);
    return this.senderResult(match ?? data, input.senderId, 'UNKNOWN');
  }

  private async safeJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  private isTermiiError(data: unknown): boolean {
    const code =
      data && typeof data === 'object'
        ? this.scalar((data as Record<string, unknown>).code)
        : null;
    return Boolean(
      data && typeof data === 'object' && code && code.toLowerCase() !== 'ok',
    );
  }

  private providerDetail(data: unknown): string | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const record = data as Record<string, unknown>;
    const message = record.message ?? record.detail ?? record.error;
    return this.scalar(message) ?? undefined;
  }

  private findSender(data: unknown, senderId: string): unknown {
    const records = Array.isArray(data)
      ? data
      : data && typeof data === 'object'
        ? ((data as Record<string, unknown>).data ??
          (data as Record<string, unknown>).sender_ids)
        : null;
    if (!Array.isArray(records)) return null;
    const normalized = senderId.toLowerCase();
    return records.find((item) => {
      if (!item || typeof item !== 'object') return false;
      const record = item as Record<string, unknown>;
      const name = record.sender_id ?? record.senderId ?? record.sender_name;
      return this.scalar(name)?.toLowerCase() === normalized;
    });
  }

  private senderResult(
    data: unknown,
    senderId: string,
    fallback: SmsSenderIdentityProviderResult['providerStatus'],
  ): SmsSenderIdentityProviderResult {
    const record =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const raw =
      record.status ??
      record.sender_status ??
      record.review_status ??
      record.code ??
      null;
    const reference =
      this.scalar(
        record.id ?? record.sender_id ?? record.senderId ?? record.sender_name,
      ) ?? senderId;
    return {
      provider: this.provider,
      providerStatus: this.toSenderProviderStatus(raw, fallback),
      providerReferenceId: reference,
      providerStatusReason: this.providerDetail(data) ?? null,
      rawProviderStatus: this.scalar(raw),
      providerPayload:
        data && typeof data === 'object'
          ? { ...(data as Record<string, unknown>) }
          : null,
    };
  }

  private toSenderProviderStatus(
    status: unknown,
    fallback: SmsSenderIdentityProviderResult['providerStatus'],
  ): SmsSenderIdentityProviderResult['providerStatus'] {
    const value = this.scalar(status)?.toLowerCase() ?? '';
    if (['pending', 'submitted', 'processing', 'in-review'].includes(value)) {
      return value === 'submitted' ? 'SUBMITTED' : 'PENDING';
    }
    if (['approved', 'active', 'ok', 'success', 'unblock'].includes(value)) {
      return 'APPROVED';
    }
    if (['rejected', 'declined', 'failed'].includes(value)) {
      return 'REJECTED';
    }
    if (['suspended', 'disabled', 'blocked'].includes(value)) {
      return 'SUSPENDED';
    }
    return fallback;
  }

  private scalar(value: unknown): string | null {
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : null;
  }
}
