import { EmailMessageDirection } from '../../../prisma/generated/client';

export interface EmailProviderVerifyInput {
  accessToken?: string;
  emailAddress: string;
}

export interface EmailProviderMailboxMetadata {
  externalMailboxId?: string;
  emailAddress?: string;
  displayName?: string;
}

export interface EmailProviderAttachmentMetadata {
  providerAttachmentId: string;
  fileName: string;
  contentType?: string;
  sizeBytes?: number;
  isInline?: boolean;
  contentId?: string;
}

export interface EmailProviderMessage {
  providerMessageId: string;
  providerThreadId: string;
  internetMessageId?: string;
  direction: EmailMessageDirection;
  subject?: string;
  fromEmail?: string;
  fromName?: string;
  toRecipients?: unknown;
  ccRecipients?: unknown;
  receivedAt?: Date;
  sentAt?: Date;
  bodyPreview?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  attachments?: EmailProviderAttachmentMetadata[];
}

export interface EmailProviderSyncResult {
  messages: EmailProviderMessage[];
  nextCursor?: string;
}

export interface EmailProviderSyncInput {
  accessToken?: string;
  limit: number;
  cursor?: string | null;
}

export interface EmailProvider {
  verifyConnection(
    input: EmailProviderVerifyInput,
  ): Promise<EmailProviderMailboxMetadata>;
  sync(input: EmailProviderSyncInput): Promise<EmailProviderSyncResult>;
}
