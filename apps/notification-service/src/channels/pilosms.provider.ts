import { Injectable, Logger } from '@nestjs/common';
import type {
  SmsProvider,
  SmsSenderIdentityProviderResult,
  SmsSenderIdentitySubmissionInput,
  SmsSendOptions,
  SmsSendResult,
} from './sms-provider.interface';

type PiloSmsResponse = {
  status?: string | number;
  detail?: string;
  sender_id?: string | number;
  sender_name?: string;
  sender_status?: string;
};

@Injectable()
export class PiloSmsProvider implements SmsProvider {
  readonly provider = 'pilosms' as const;
  readonly senderIdentityCapabilities = {
    submitSenderIdentity: true,
    refreshSenderIdentityStatus: false,
  };
  private readonly logger = new Logger(PiloSmsProvider.name);
  private readonly apiKey = process.env.PILOSMS_API_KEY;
  private readonly senderId = process.env.PILOSMS_SENDER_ID || 'WorkPhelo';
  private readonly baseUrl = 'https://api.pilosms.com/v1';

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
        error: 'PILOSMS_API_KEY is required',
      };
    }

    const recipient = this.toPiloRecipient(to);
    if (!recipient) {
      return {
        success: false,
        status: 'SKIPPED',
        provider: this.provider,
        providerStatus: '1006',
        providerDetail: 'No valid numbers',
        error: 'Invalid phone number for PiloSMS',
      };
    }

    const body = new URLSearchParams({
      sender: options?.senderId || this.senderId,
      message,
      receipients: recipient,
    });

    try {
      const response = await fetch(
        `${this.baseUrl}/send-message?apikey=${encodeURIComponent(
          this.apiKey,
        )}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        },
      );
      const data = await this.safeJson(response);
      const providerStatus =
        data && typeof data === 'object' && 'status' in data
          ? String(data.status)
          : undefined;
      const providerDetail =
        data && typeof data === 'object' && 'detail' in data
          ? String(data.detail)
          : undefined;
      const status = this.toDeliveryStatus(providerStatus);

      if (!response.ok || status !== 'SENT') {
        this.logger.error(
          `PiloSMS send failed for ${to}: status=${providerStatus ?? 'unknown'} detail=${providerDetail ?? 'unknown'}`,
        );
      }

      return {
        success: status === 'SENT',
        status,
        provider: this.provider,
        providerStatus,
        providerDetail,
        error: status === 'SENT' ? undefined : providerDetail,
      };
    } catch (error) {
      this.logger.error(`Failed to send PiloSMS message to ${to}`, error);
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
    if (!this.apiKey) {
      throw new Error('PILOSMS_API_KEY is required');
    }
    const purpose = input.purpose.trim();
    if (purpose.length < 10) {
      throw new Error('Sender purpose must be at least 10 characters');
    }

    const body = new URLSearchParams({
      sender_name: input.senderId,
      sender_purpose: purpose,
    });

    const response = await fetch(
      `${this.baseUrl}/register-sender?apikey=${encodeURIComponent(
        this.apiKey,
      )}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );
    const data = await this.safeJson(response);
    const status = data?.status === undefined ? undefined : String(data.status);
    const detail = data?.detail;

    if (!response.ok || status !== '1001') {
      throw new Error(detail || `PiloSMS sender registration failed`);
    }

    return {
      provider: this.provider,
      providerStatus: 'PENDING',
      providerReferenceId:
        data?.sender_id === undefined ? null : String(data.sender_id),
      providerStatusReason: detail ?? data?.sender_status ?? null,
      rawProviderStatus: data?.sender_status ?? status ?? null,
      providerPayload: this.safePayload(data),
    };
  }

  private toPiloRecipient(phone: string): string | null {
    const normalized = phone.trim().replace(/[\s\-()]/g, '');
    if (!normalized.startsWith('+')) {
      return null;
    }

    const withoutPlus = normalized.slice(1);

    if (!/^\d{8,15}$/.test(withoutPlus)) {
      return null;
    }

    return withoutPlus;
  }

  private toDeliveryStatus(
    status: string | undefined,
  ): SmsSendResult['status'] {
    if (status === '1001') return 'SENT';
    if (status === '1006') return 'SKIPPED';
    return 'FAILED';
  }

  private async safeJson(response: Response): Promise<PiloSmsResponse | null> {
    try {
      return (await response.json()) as PiloSmsResponse;
    } catch {
      return null;
    }
  }

  private safePayload(
    data: PiloSmsResponse | null,
  ): Record<string, unknown> | null {
    if (!data) return null;
    return { ...data };
  }
}
