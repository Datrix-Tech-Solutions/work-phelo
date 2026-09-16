import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AccountingReceivableStatus,
  AccountingSettlementMethod,
} from '../../../prisma/generated/client';

const uppercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateReceivableInvoiceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  documentDate!: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ example: 'GHS', minLength: 3, maxLength: 3 })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({
    example: 1000,
    minimum: 0.0001,
    description: 'The subtotal, before any tax lines the rule adds on top.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amount!: number;

  @ApiPropertyOptional({ example: 1.25, minimum: 0.00000001 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  exchangeRate?: number;

  @ApiProperty({
    format: 'uuid',
    description:
      'The Receivable-category Transaction Type driving this invoice — its Rule resolves ' +
      'the offset account and any tax lines. A Rule must exist for it.',
  })
  @IsUUID()
  transactionTypeId!: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      "Which of the Rule's Deduction (tax) lines to apply, by TaxType id — each computes " +
      'its own amount from the rate and posts to its own account.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  selectedTaxTypeIds?: string[];

  @ApiPropertyOptional({ example: 'Consulting invoice' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'EXT-INV-1001' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  externalReference?: string;

  @ApiPropertyOptional({ example: 'CRM' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  sourceModule?: string;

  @ApiPropertyOptional({ example: 'crm-invoice-id' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  sourceRecordId?: string;
}

export class CreateReceivableCreditNoteDto extends PartialType(
  CreateReceivableInvoiceDto,
) {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  documentDate!: string;

  @ApiProperty({ example: 'GHS', minLength: 3, maxLength: 3 })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ example: 250, minimum: 0.0001 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amount!: number;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  taxAmount?: number;

  @ApiProperty({
    format: 'uuid',
    description:
      'Posting-enabled revenue or other offset account debited when the credit note is posted.',
  })
  @IsUUID()
  offsetGlAccountId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'Posting-enabled asset account credited when the credit note is posted — picked ' +
      'manually here since credit notes are not yet Rule-driven.',
  })
  @IsUUID()
  arAccountId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Optional posted invoice this credit note applies to. Invoice-specific credits cannot exceed invoice outstanding.',
  })
  @IsOptional()
  @IsUUID()
  originalInvoiceId?: string;
}

export class CreateReceivableReceiptDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'The posted invoice this receipt is being recorded to pay. The receipt inherits ' +
      "that invoice's own resolved AR account, and can only ever be allocated against " +
      'invoices sharing that same account.',
  })
  @IsUUID()
  invoiceId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cashAccountId!: string;

  @ApiProperty({ example: 1000, minimum: 0.0001 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amount!: number;

  @ApiProperty({ example: 'GHS', minLength: 3, maxLength: 3 })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  receiptDate!: string;

  @ApiProperty({ enum: AccountingSettlementMethod })
  @IsEnum(AccountingSettlementMethod)
  settlementMethod!: AccountingSettlementMethod;

  @ApiPropertyOptional({ example: 'BANK-REF-001' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({ example: 'Customer receipt' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 1.25, minimum: 0.00000001 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  exchangeRate?: number;

  @ApiPropertyOptional({ example: 'EXT-RCPT-1001' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  externalReference?: string;

  @ApiPropertyOptional({ example: 'CRM' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  sourceModule?: string;

  @ApiPropertyOptional({ example: 'crm-receipt-id' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  sourceRecordId?: string;
}

export class QueryReceivableDocumentsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ enum: AccountingReceivableStatus })
  @IsOptional()
  @IsEnum(AccountingReceivableStatus)
  status?: AccountingReceivableStatus;

  @ApiPropertyOptional({ example: 'GHS' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @ApiPropertyOptional({ example: 'INV-20260810' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}

export class QueryReceivableAgingDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description: 'Defaults to today.',
  })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Optionally limit the aging to one customer.',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

export class QueryReceiptsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cashAccountId?: string;

  @ApiPropertyOptional({ enum: AccountingReceivableStatus })
  @IsOptional()
  @IsEnum(AccountingReceivableStatus)
  status?: AccountingReceivableStatus;

  @ApiPropertyOptional({ example: 'GHS' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ example: 'RCPT-20260810' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateReceiptAllocationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  invoiceId!: string;

  @ApiProperty({ example: 500, minimum: 0.0001 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amount!: number;
}

export class CreateCreditNoteAllocationDto extends CreateReceiptAllocationDto {}

export class ReverseReceivableDto {
  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  reversalDate!: string;

  @ApiProperty({ example: 'Correction approved by finance' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class ReverseAllocationDto {
  @ApiProperty({ example: 'Allocation applied to wrong invoice' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  reason!: string;
}
