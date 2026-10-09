import { Injectable, Logger } from '@nestjs/common';
import type {
  SmsProvider,
  SmsSenderIdentityProviderResult,
  SmsSenderIdentityStatusInput,
  SmsSenderIdentitySubmissionInput,
  SmsSendOptions,
  SmsSendResult,
} from './sms-provider.interface';

type SasuSyncResponse = {
  success?: boolean;
  queued?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  status?: string | number;
  code?: string | number;
  data?: {
    job_id?: string | number;
    jobId?: string | number;
    message_id?: string | number;
    messageId?: string | number;
    id?: string | number;
    status?: string | number;
    recipients_count?: string | number;
  };
  sender_name?: string;
  review_status?: string;
  delivery_status?: string;
  reason?: string;
};

@Injectable()
export class SasuSyncSmsProvider implements SmsProvider {
  readonly provider = 'sasusync' as const;
  readonly senderIdentityCapabilities = {
    submitSenderIdentity: true,
    refreshSenderIdentityStatus: true,
  };
  private readonly logger = new Logger(SasuSyncSmsProvider.name);
  private readonly apiKey = process.env.SASUSYNC_API_KEY;
  private readonly senderId = process.env.SASUSYNC_SENDER_ID || 'WorkPhelo';
  private readonly baseUrl =
    process.env.SASUSYNC_BASE_URL || 'https://sms.sasusync.com';
  private readonly sandbox = this.parseBoolean(
    process.env.SASUSYNC_SANDBOX,
    true,
  );

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
        error: 'SASUSYNC_API_KEY is required',
      };
    }

    const recipient = this.toGhanaRecipient(to);
    if (!recipient) {
      return {
        success: false,
        status: 'SKIPPED',
        provider: this.provider,
        providerStatus: 'INVALID_RECIPIENT',
        providerDetail: 'Invalid Ghana phone number',
        error: 'Invalid Ghana phone number for SasuSync',
      };
    }

    const body = {
      sender: options?.senderId || this.senderId,
      recipients: [recipient],
      message,
    };

    try {
      const response = await fetch(this.sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(body),
      });
      const data = await this.safeJson(response);
      const providerStatus = this.providerStatus(data, response);
      const providerDetail = this.providerDetail(data);
      const providerMessageId = this.providerMessageId(data);
      const accepted = response.ok && this.isAccepted(data);

      if (!accepted) {
        this.logger.error(
          `SasuSync SMS failed for ${to}: status=${providerStatus ?? response.status} detail=${providerDetail ?? response.statusText}`,
        );
      }

      return {
        success: accepted,
        status: accepted ? 'SENT' : 'FAILED',
        provider: this.provider,
        providerMessageId,
        providerStatus,
        providerDetail,
        error: accepted
          ? undefined
          : providerDetail ||
            `SasuSync SMS failed with HTTP ${response.status}`,
      };
    } catch (error) {
      this.logger.error(`Failed to send SasuSync SMS to ${to}`, error);
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
    if (!this.apiKey) throw new Error('SASUSYNC_API_KEY is required');
    const purpose = input.purpose.trim();
    if (purpose.length < 10) {
      throw new Error('Sender purpose must be at least 10 characters');
    }

    const response = await fetch(
      `${this.baseUrl.replace(/\/+$/, '')}/sender/id/register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({
          sender_name: input.senderId,
          purpose,
        }),
      },
    );
    const data = await this.safeJson(response);
    if (!response.ok || data?.success === false) {
      throw new Error(
        this.providerDetail(data) ||
          `SasuSync sender registration failed with HTTP ${response.status}`,
      );
    }
    return this.senderResult(data, 'PENDING');
  }

  async getSenderIdentityStatus(
    input: SmsSenderIdentityStatusInput,
  ): Promise<SmsSenderIdentityProviderResult> {
    if (!this.apiKey) throw new Error('SASUSYNC_API_KEY is required');
    const url = new URL(`${this.baseUrl.replace(/\/+$/, '')}/sender/id/status`);
    url.searchParams.set('sender_name', input.senderId);
    const response = await fetch(url, {
      headers: { 'X-API-Key': this.apiKey },
    });
    const data = await this.safeJson(response);
    if (!response.ok || data?.success === false) {
      throw new Error(
        this.providerDetail(data) ||
          `SasuSync sender status lookup failed with HTTP ${response.status}`,
      );
    }
    return this.senderResult(data);
  }

  private get sendUrl(): string {
    const path = this.sandbox ? '/smssandbox/v1/send' : '/api/v1/send';
    return `${this.baseUrl.replace(/\/+$/, '')}${path}`;
  }

  private toGhanaRecipient(phone: string): string | null {
    const normalized = phone.trim().replace(/[\s\-()]/g, '');
    let candidate = normalized;

    if (candidate.startsWith('+')) {
      candidate = candidate.slice(1);
    } else if (candidate.startsWith('0')) {
      candidate = `233${candidate.slice(1)}`;
    }

    if (!/^233\d{9}$/.test(candidate)) {
      return null;
    }

    return candidate;
  }

  private isAccepted(data: SasuSyncResponse | null): boolean {
    if (!data) return true;
    if (data.success === false) return false;
    if (data.success === true) return true;

    const status = this.providerStatus(data)?.toLowerCase();
    if (!status) return true;

    return [
      'queued',
      'accepted',
      'submitted',
      'sent',
      'ok',
      'success',
    ].includes(status);
  }

  private providerStatus(
    data: SasuSyncResponse | null,
    response?: Response,
  ): string | undefined {
    const status =
      data?.data?.status ?? data?.status ?? data?.code ?? response?.status;
    return status === undefined ? undefined : String(status);
  }

  private providerDetail(data: SasuSyncResponse | null): string | undefined {
    return data?.detail ?? data?.message ?? data?.error;
  }

  private providerMessageId(data: SasuSyncResponse | null): string | undefined {
    const id =
      data?.data?.job_id ??
      data?.data?.jobId ??
      data?.data?.message_id ??
      data?.data?.messageId ??
      data?.data?.id;
    return id === undefined ? undefined : String(id);
  }

  private senderResult(
    data: SasuSyncResponse | null,
    fallbackStatus: SmsSenderIdentityProviderResult['providerStatus'] = 'UNKNOWN',
  ): SmsSenderIdentityProviderResult {
    const raw =
      data?.review_status ??
      data?.data?.status ??
      data?.status ??
      data?.delivery_status ??
      null;
    return {
      provider: this.provider,
      providerStatus: this.toSenderProviderStatus(raw, fallbackStatus),
      providerReferenceId: data?.sender_name ?? null,
      providerStatusReason:
        data?.reason ?? data?.detail ?? data?.message ?? data?.error ?? null,
      rawProviderStatus: this.scalar(raw),
      providerPayload: data ? { ...data } : null,
    };
  }

  private toSenderProviderStatus(
    status: unknown,
    fallback: SmsSenderIdentityProviderResult['providerStatus'],
  ): SmsSenderIdentityProviderResult['providerStatus'] {
    const value = this.scalar(status)?.toLowerCase() ?? '';
    if (['pending', 'pending_review', 'review', 'in_review'].includes(value)) {
      return 'PENDING';
    }
    if (['approved', 'active', 'verified'].includes(value)) {
      return 'APPROVED';
    }
    if (value === 'not_found') {
      return 'NOT_SUBMITTED';
    }
    if (['rejected', 'declined'].includes(value)) {
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

  private parseBoolean(
    value: string | undefined,
    defaultValue: boolean,
  ): boolean {
    if (value === undefined || value.trim() === '') return defaultValue;
    return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase());
  }

  private async safeJson(response: Response): Promise<SasuSyncResponse | null> {
    try {
      return (await response.json()) as SasuSyncResponse;
    } catch {
      return null;
    }
  }
}
