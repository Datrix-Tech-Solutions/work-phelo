import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsHexColor,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const DOCUMENT_TEMPLATE_SLOT_POSITIONS = [
  'start',
  'middle',
  'end',
] as const;
export const DOCUMENT_TEMPLATE_WATERMARK_MODES = [
  'none',
  'text',
  'image',
] as const;
export const DOCUMENT_TEMPLATE_SIGNATURE_POSITIONS = ['left', 'right'] as const;
export const DOCUMENT_TEMPLATE_DOCUMENT_KEYS = [
  'payslip',
  'bill',
  'invoice',
  'credit-note',
  'debit-note',
  'payment-receipt',
  'payment-voucher',
] as const;

export type DocumentTemplateSlotPosition =
  (typeof DOCUMENT_TEMPLATE_SLOT_POSITIONS)[number];
export type DocumentTemplateDocumentKey =
  (typeof DOCUMENT_TEMPLATE_DOCUMENT_KEYS)[number];

/**
 * Layout/presentation settings for generated documents. Images (logo,
 * signature) and the signatory name/title live on the document profile; the
 * watermark image is stored on the template record itself.
 */
export class DocumentTemplateConfigDto {
  @ApiProperty()
  @IsBoolean()
  showLogo!: boolean;

  @ApiProperty({ enum: DOCUMENT_TEMPLATE_SLOT_POSITIONS })
  @IsIn(DOCUMENT_TEMPLATE_SLOT_POSITIONS)
  logoPosition!: DocumentTemplateSlotPosition;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  companyName!: string;

  @ApiProperty({ description: 'Letterhead detail lines, one per line.' })
  @IsString()
  @MaxLength(1000)
  identityLines!: string;

  @ApiProperty()
  @IsBoolean()
  showCompanyName!: boolean;

  @ApiProperty({ enum: DOCUMENT_TEMPLATE_SLOT_POSITIONS })
  @IsIn(DOCUMENT_TEMPLATE_SLOT_POSITIONS)
  companyNamePosition!: DocumentTemplateSlotPosition;

  @ApiProperty()
  @IsBoolean()
  showQr!: boolean;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  qrValue!: string;

  @ApiProperty({ enum: DOCUMENT_TEMPLATE_SLOT_POSITIONS })
  @IsIn(DOCUMENT_TEMPLATE_SLOT_POSITIONS)
  qrPosition!: DocumentTemplateSlotPosition;

  @ApiProperty({ example: '#1e3a8a' })
  @IsHexColor()
  accent!: string;

  @ApiProperty({ enum: ['sans', 'serif'] })
  @IsIn(['sans', 'serif'])
  font!: 'sans' | 'serif';

  @ApiProperty({ enum: ['a4', 'letter'] })
  @IsIn(['a4', 'letter'])
  paper!: 'a4' | 'letter';

  @ApiProperty({ enum: ['comfortable', 'compact'] })
  @IsIn(['comfortable', 'compact'])
  margin!: 'comfortable' | 'compact';

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  footerLocation!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  footerAddress!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  footerTel!: string;

  @ApiProperty()
  @IsBoolean()
  showPageNumbers!: boolean;

  @ApiProperty({ enum: DOCUMENT_TEMPLATE_WATERMARK_MODES })
  @IsIn(DOCUMENT_TEMPLATE_WATERMARK_MODES)
  watermarkMode!: (typeof DOCUMENT_TEMPLATE_WATERMARK_MODES)[number];

  @ApiProperty()
  @IsString()
  @MaxLength(60)
  watermarkText!: string;

  @ApiProperty()
  @IsBoolean()
  watermarkTiled!: boolean;

  @ApiProperty()
  @IsBoolean()
  signatureEnabled!: boolean;

  @ApiProperty({ enum: DOCUMENT_TEMPLATE_SIGNATURE_POSITIONS })
  @IsIn(DOCUMENT_TEMPLATE_SIGNATURE_POSITIONS)
  signaturePosition!: (typeof DOCUMENT_TEMPLATE_SIGNATURE_POSITIONS)[number];

  @ApiProperty({
    description: 'Per-document signature visibility, keyed by document type.',
    example: { invoice: true, payslip: false },
  })
  @IsObject()
  signatureRules!: Record<DocumentTemplateDocumentKey, boolean>;
}

export class UpsertTenantDocumentTemplateDto {
  @ApiProperty({ type: DocumentTemplateConfigDto })
  @ValidateNested()
  @Type(() => DocumentTemplateConfigDto)
  config!: DocumentTemplateConfigDto;

  @ApiPropertyOptional({
    description:
      'Version the editor loaded. A mismatch returns 409 so concurrent edits are not silently overwritten.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedVersion?: number;
}

export class TenantDocumentTemplateResponseDto {
  @ApiPropertyOptional({ nullable: true })
  id!: string | null;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ type: DocumentTemplateConfigDto })
  config!: DocumentTemplateConfigDto;

  @ApiPropertyOptional({ nullable: true })
  watermarkFileName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  watermarkMimeType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  watermarkSizeBytes!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Short-lived signed URL for reading the watermark image.',
  })
  watermarkUrl!: string | null;

  @ApiProperty({ description: '0 when nothing has been saved yet.' })
  version!: number;

  @ApiProperty({ description: 'True when the stored record does not exist.' })
  defaultsApplied!: boolean;

  @ApiPropertyOptional({ nullable: true })
  updatedAt!: Date | null;
}
