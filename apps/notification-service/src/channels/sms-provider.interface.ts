export type SmsProviderName = 'termii' | 'pilosms' | 'sasusync' | 'agoosms';

export type SmsProviderVerificationStatus =
  | 'NOT_SUBMITTED'
  | 'SUBMITTED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'UNKNOWN';

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

export type SmsSenderIdentityCapabilities = {
  submitSenderIdentity: boolean;
  refreshSenderIdentityStatus: boolean;
};

export type SmsSenderIdentitySubmissionInput = {
  senderId: string;
  purpose: string;
  tenantId?: string;
  senderIdentityId?: string;
  tenantDomain?: string | null;
};

export type SmsSenderIdentityStatusInput = {
  senderId: string;
  providerReferenceId?: string | null;
  tenantId?: string;
  senderIdentityId?: string;
};

export type SmsSenderIdentityProviderResult = {
  provider: SmsProviderName;
  providerStatus: SmsProviderVerificationStatus;
  providerReferenceId?: string | null;
  providerStatusReason?: string | null;
  providerPayload?: Record<string, unknown> | null;
  rawProviderStatus?: string | null;
};

export interface SmsProvider {
  readonly provider: SmsProviderName;
  readonly senderIdentityCapabilities?: SmsSenderIdentityCapabilities;
  sendMessage(
    to: string,
    message: string,
    options?: SmsSendOptions,
  ): Promise<SmsSendResult>;
  submitSenderIdentity?(
    input: SmsSenderIdentitySubmissionInput,
  ): Promise<SmsSenderIdentityProviderResult>;
  getSenderIdentityStatus?(
    input: SmsSenderIdentityStatusInput,
  ): Promise<SmsSenderIdentityProviderResult>;
}
