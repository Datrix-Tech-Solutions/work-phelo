import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EmailMessageDirection,
  MailboxConnectionStatus,
  MailboxProvider,
} from '../../../prisma/generated/client';
import { ApiErrorResponseDto } from '../../counterparties/dto/counterparty-response.dto';

export { ApiErrorResponseDto };

export class MailboxConnectionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ enum: MailboxProvider })
  provider!: MailboxProvider;

  @ApiProperty({ example: 'placements@broker.example' })
  emailAddress!: string;

  @ApiProperty({ example: 'placements@broker.example' })
  normalizedEmail!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  displayName!: string | null;

  @ApiProperty({ enum: MailboxConnectionStatus })
  status!: MailboxConnectionStatus;

  @ApiPropertyOptional({ type: String, nullable: true })
  externalMailboxId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  tokenExpiresAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  lastSyncedAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  lastSyncError!: string | null;

  @ApiProperty({ format: 'uuid' })
  connectedByUserId!: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  archivedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class EmailThreadResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  mailboxConnectionId!: string;

  @ApiProperty({ example: 'AAMkAG...' })
  providerThreadId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  subject!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Provider-normalized participant summary JSON.',
  })
  participants!: unknown;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  lastMessageAt!: string | null;

  @ApiProperty({ example: 3 })
  messageCount!: number;

  @ApiProperty({ example: true })
  hasAttachments!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  archivedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class EmailAttachmentMetadataResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  messageId!: string;

  @ApiProperty({ example: 'AAMkAG_attachment_1' })
  providerAttachmentId!: string;

  @ApiProperty({ example: 'slip.pdf' })
  fileName!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'application/pdf',
  })
  contentType!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 24018 })
  sizeBytes!: number | null;

  @ApiProperty({ example: false })
  isInline!: boolean;
}

export class EmailMessageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  mailboxConnectionId!: string;

  @ApiProperty({ format: 'uuid' })
  threadId!: string;

  @ApiProperty({ example: 'AAMkAG_message_1' })
  providerMessageId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  internetMessageId!: string | null;

  @ApiProperty({ enum: EmailMessageDirection })
  direction!: EmailMessageDirection;

  @ApiPropertyOptional({ type: String, nullable: true })
  subject!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  fromEmail!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  fromName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  toRecipients!: unknown;

  @ApiPropertyOptional({ nullable: true })
  ccRecipients!: unknown;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  receivedAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  sentAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  bodyPreview!: string | null;

  @ApiProperty({ example: false })
  hasAttachments!: boolean;

  @ApiProperty({ example: false })
  isRead!: boolean;

  @ApiProperty({ type: [EmailAttachmentMetadataResponseDto] })
  attachments!: EmailAttachmentMetadataResponseDto[];
}

export class PlacementEmailLinkResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({ format: 'uuid' })
  threadId!: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  messageId!: string | null;

  @ApiProperty({ format: 'uuid' })
  linkedByUserId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  note!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  archivedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class PageMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class PaginatedMailboxesResponseDto {
  @ApiProperty({ type: [MailboxConnectionResponseDto] })
  items!: MailboxConnectionResponseDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

export class PaginatedEmailThreadsResponseDto {
  @ApiProperty({ type: [EmailThreadResponseDto] })
  items!: EmailThreadResponseDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

export class PaginatedEmailMessagesResponseDto {
  @ApiProperty({ type: [EmailMessageResponseDto] })
  items!: EmailMessageResponseDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

export class MailboxSyncResponseDto {
  @ApiProperty({ type: MailboxConnectionResponseDto })
  mailbox!: MailboxConnectionResponseDto;

  @ApiProperty({ example: 2 })
  threadsSynced!: number;

  @ApiProperty({ example: 5 })
  messagesSynced!: number;
}
