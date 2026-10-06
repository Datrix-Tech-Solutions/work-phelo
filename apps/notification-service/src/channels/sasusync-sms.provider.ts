import { Injectable, Logger } from '@nestjs/common';
import type {
  SmsProvider,
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
};

@Injectable()
export class SasuSyncSmsProvider implements SmsProvider {
  readonly provider = 'sasusync' as const;
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
