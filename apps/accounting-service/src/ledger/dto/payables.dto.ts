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
  AccountingPayableStatus,
  AccountingSettlementMethod,
} from '../../../prisma/generated/client';

const uppercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePayableBillDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vendorId!: string;

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
      'The Payable-category Transaction Type driving this bill — its Rule resolves the ' +
      'offset account and any tax lines. A Rule must exist for it.',
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

  @ApiPropertyOptional({ example: 'Vendor bill' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'EXT-BILL-1001' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  externalReference?: string;

  @ApiPropertyOptional({ example: 'PROCUREMENT' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  sourceModule?: string;

  @ApiPropertyOptional({ example: 'source-bill-id' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  sourceRecordId?: string;
}

export class CreatePayableCreditNoteDto extends PartialType(
  CreatePayableBillDto,
) {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vendorId!: string;

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
      'Posting-enabled expense, asset or other offset account credited when the vendor credit is posted.',
  })
  @IsUUID()
  offsetGlAccountId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'Posting-enabled liability account debited when the vendor credit is posted — ' +
      'picked manually here since credit notes are not yet Rule-driven.',
  })
  @IsUUID()
  apAccountId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Optional posted bill this credit note applies to. Bill-specific credits cannot exceed bill outstanding.',
  })
  @IsOptional()
  @IsUUID()
  originalBillId?: string;
}

export class CreatePayablePaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vendorId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'The posted bill this payment is being recorded to pay. The payment inherits that ' +
      "bill's own resolved AP account, and can only ever be allocated against bills " +
      'sharing that same account.',
  })
  @IsUUID()
  billId!: string;

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
  paymentDate!: string;

  @ApiProperty({ enum: AccountingSettlementMethod })
  @IsEnum(AccountingSettlementMethod)
  settlementMethod!: AccountingSettlementMethod;

  @ApiPropertyOptional({ example: 'BANK-PAY-001' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({ example: 'Vendor payment' })
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

  @ApiPropertyOptional({ example: 'EXT-PAY-1001' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  externalReference?: string;

  @ApiPropertyOptional({ example: 'PROCUREMENT' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  sourceModule?: string;

  @ApiPropertyOptional({ example: 'source-payment-id' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  sourceRecordId?: string;
}

export class QueryPayableDocumentsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiPropertyOptional({ enum: AccountingPayableStatus })
  @IsOptional()
  @IsEnum(AccountingPayableStatus)
  status?: AccountingPayableStatus;

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

  @ApiPropertyOptional({ example: 'BILL-20260811' })
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

export class QueryPayableAgingDto {
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
    description: 'Optionally limit the aging to one vendor.',
  })
  @IsOptional()
  @IsUUID()
  vendorId?: string;
}

export class QueryPayablePaymentsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cashAccountId?: string;

  @ApiPropertyOptional({ enum: AccountingPayableStatus })
  @IsOptional()
  @IsEnum(AccountingPayableStatus)
  status?: AccountingPayableStatus;

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

  @ApiPropertyOptional({ example: 'APP-20260811' })
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

export class CreatePaymentAllocationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  billId!: string;

  @ApiProperty({ example: 500, minimum: 0.0001 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amount!: number;
}

export class CreateVendorCreditAllocationDto extends CreatePaymentAllocationDto {}

export class ReversePayableDto {
  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  reversalDate!: string;

  @ApiProperty({ example: 'Correction approved by finance' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class ReversePayableAllocationDto {
  @ApiProperty({ example: 'Allocation applied to wrong bill' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  reason!: string;
}
