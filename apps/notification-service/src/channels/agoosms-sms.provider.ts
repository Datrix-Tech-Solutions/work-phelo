import { Injectable, Logger } from '@nestjs/common';
import type {
  SmsProvider,
  SmsSendOptions,
  SmsSendResult,
} from './sms-provider.interface';

type AgooSmsResponse = {
  success?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  status?: string | number;
  code?: string | number;
  id?: string | number;
  messageId?: string | number;
  message_id?: string | number;
  reference?: string | number;
  data?: {
    id?: string | number;
    messageId?: string | number;
    message_id?: string | number;
    reference?: string | number;
    status?: string | number;
  };
};

@Injectable()
export class AgooSmsProvider implements SmsProvider {
  readonly provider = 'agoosms' as const;
  private readonly logger = new Logger(AgooSmsProvider.name);
  private readonly apiKey = process.env.AGOOSMS_API_KEY;
  private readonly baseUrl =
    process.env.AGOOSMS_BASE_URL || 'https://api.agoosms.com';
  private readonly sandbox = this.parseBoolean(
    process.env.AGOOSMS_SANDBOX,
    true,
  );

  async sendMessage(
    to: string,
    message: string,
    options?: SmsSendOptions,
  ): Promise<SmsSendResult> {
    void options;

    if (!this.apiKey) {
      return {
        success: false,
        status: 'FAILED',
        provider: this.provider,
        error: 'AGOOSMS_API_KEY is required',
      };
    }

    const recipient = this.toE164GhanaRecipient(to);
    if (!recipient) {
      return {
        success: false,
        status: 'SKIPPED',
        provider: this.provider,
        providerStatus: 'INVALID_RECIPIENT',
        providerDetail: 'Invalid Ghana phone number',
        error: 'Invalid Ghana phone number for AgooSMS',
      };
    }

    try {
      const response = await fetch(this.sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({
          to: recipient,
          message,
        }),
      });
      const data = await this.safeJson(response);
      const providerStatus = this.providerStatus(data, response);
      const providerDetail = this.providerDetail(data);
      const providerMessageId = this.providerMessageId(data);
      const accepted = response.ok && this.isAccepted(data);

      if (!accepted) {
        this.logger.error(
          `AgooSMS send failed for ${to}: status=${providerStatus ?? response.status} detail=${providerDetail ?? response.statusText}`,
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
          : providerDetail || `AgooSMS failed with HTTP ${response.status}`,
      };
    } catch (error) {
      this.logger.error(`Failed to send AgooSMS message to ${to}`, error);
      return {
        success: false,
        status: 'FAILED',
        provider: this.provider,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private get sendUrl(): string {
    const sandboxPath = process.env.AGOOSMS_SANDBOX_PATH || '/v1/sms/send';
    const livePath = process.env.AGOOSMS_LIVE_PATH || '/v1/sms/send';
    const path = this.sandbox ? sandboxPath : livePath;
    return `${this.baseUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private toE164GhanaRecipient(phone: string): string | null {
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

    return `+${candidate}`;
  }

  private isAccepted(data: AgooSmsResponse | null): boolean {
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
    data: AgooSmsResponse | null,
    response?: Response,
  ): string | undefined {
    const status =
      data?.data?.status ?? data?.status ?? data?.code ?? response?.status;
    return status === undefined ? undefined : String(status);
  }

  private providerDetail(data: AgooSmsResponse | null): string | undefined {
    return data?.detail ?? data?.message ?? data?.error;
  }

  private providerMessageId(data: AgooSmsResponse | null): string | undefined {
    const id =
      data?.data?.id ??
      data?.data?.messageId ??
      data?.data?.message_id ??
      data?.data?.reference ??
      data?.id ??
      data?.messageId ??
      data?.message_id ??
      data?.reference;
    return id === undefined ? undefined : String(id);
  }

  private parseBoolean(
    value: string | undefined,
    defaultValue: boolean,
  ): boolean {
    if (value === undefined || value.trim() === '') return defaultValue;
    return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase());
  }

  private async safeJson(response: Response): Promise<AgooSmsResponse | null> {
    try {
      return (await response.json()) as AgooSmsResponse;
    } catch {
      return null;
    }
  }
}
