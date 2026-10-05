export type SmsProviderName = 'termii' | 'pilosms';

export type SmsDeliveryStatus = 'SENT' | 'FAILED' | 'SKIPPED';

export type SmsSendResult = {
  success: boolean;
  status: SmsDeliveryStatus;
  provider: SmsProviderName;
  providerMessageId?: string;
  providerStatus?: string;
  providerDetail?: string;
  error?: string;
};

export type SmsSendOptions = {
  senderId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

export interface SmsProvider {
  readonly provider: SmsProviderName;
  sendMessage(
    to: string,
    message: string,
    options?: SmsSendOptions,
  ): Promise<SmsSendResult>;
}
