import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
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
  ValidateNested,
} from 'class-validator';
import {
  AccountingReceivableStatus,
  AccountingSettlementMethod,
} from '../../../prisma/generated/client';
import { SettlementAdjustmentDto } from './cashbook.dto';
import {
  DocumentAdjustmentDto,
  DocumentTaxDto,
} from './document-adjustments.dto';
import { DocumentLineDto } from './document-lines.dto';

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

  @ApiPropertyOptional({
    example: 1000,
    minimum: 0.0001,
    description:
      'The subtotal, before any taxes, deductions or charges. Required unless `lines` is sent; with `lines` it is optional and, when sent, must equal their sum.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amount?: number;

  @ApiPropertyOptional({
    type: [DocumentLineDto],
    description:
      "The items on the document, each with its own account (inside the rule's scope), amount and optional cost centre. The subtotal is their sum. Send this instead of `amount`, `quantity`, `unitPrice`, `offsetGlAccountId` and `costCentreId`.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => DocumentLineDto)
  lines?: DocumentLineDto[];

  @ApiPropertyOptional({
    example: 2,
    minimum: 0.0001,
    description:
      'Optional descriptive quantity. Sent together with unitPrice; amount must equal quantity × unitPrice rounded to 2 decimals.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity?: number;

  @ApiPropertyOptional({ example: 13.69, minimum: 0.0001 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  unitPrice?: number;

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
    format: 'uuid',
    description:
      "Required when the type's rule scopes its main line to a category or classification " +
      'instead of one fixed account: the account picked on the form, which must sit inside ' +
      'that scope. Ignored (and must match) when the rule fixes the account.',
  })
  @IsOptional()
  @IsUUID()
  offsetGlAccountId?: string;

  @ApiPropertyOptional({
    type: [DocumentTaxDto],
    description:
      'Taxes added on the form: a tax type and the account it posts to. Each amount is the tax type rate × the amount, worked out by the server.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DocumentTaxDto)
  taxes?: DocumentTaxDto[];

  @ApiPropertyOptional({
    type: [DocumentAdjustmentDto],
    description:
      'Deductions (reduce what is owed) and charges (add to it) added on the form. The total is the amount, plus taxes and charges, less deductions.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DocumentAdjustmentDto)
  adjustments?: DocumentAdjustmentDto[];

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

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Optional active cost centre (department) this invoice belongs to. Carried onto the ' +
      'offset (P&L) journal line when posted — not the AR control line or tax lines — so ' +
      'budgets and reports can slice by department.',
  })
  @IsOptional()
  @IsUUID()
  costCentreId?: string;

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

  @ApiPropertyOptional({
    example: 250,
    minimum: 0.0001,
    description:
      'Required unless `lines` is sent (a Rule-driven note); with `lines` it must equal their sum.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amount?: number;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Posting-enabled revenue or other offset account debited when the credit note is posted.',
  })
  @IsOptional()
  @IsUUID()
  offsetGlAccountId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Posting-enabled asset account credited when the credit note is posted — picked ' +
      'manually here since credit notes are not yet Rule-driven.',
  })
  @IsOptional()
  @IsUUID()
  arAccountId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Optional posted invoice this credit note applies to. Invoice-specific credits cannot exceed invoice outstanding. Required when the credit note is created from a linked transactionTypeId.',
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

  @ApiPropertyOptional({
    type: [SettlementAdjustmentDto],
    description:
      'Deductions (discount, withholding tax) and charges (bank charge) taken at settlement. `amount` is what is settled against the document; the cash that moves is that amount less deductions plus charges, and must stay above zero.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SettlementAdjustmentDto)
  adjustments?: SettlementAdjustmentDto[];
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

/** A posted invoice edited while its period is open: the whole form again, plus an optional reason. */
export class EditReceivableInvoiceDto {
  @ApiProperty({ type: CreateReceivableInvoiceDto })
  @ValidateNested()
  @Type(() => CreateReceivableInvoiceDto)
  invoice!: CreateReceivableInvoiceDto;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** Restoring a voided invoice: send the form to correct it, or nothing to bring it back as it was. */
export class RestoreReceivableInvoiceDto {
  @ApiPropertyOptional({ type: CreateReceivableInvoiceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateReceivableInvoiceDto)
  invoice?: CreateReceivableInvoiceDto;
}

/** What can change on a posted credit note - its amount stays, since it is applied against an invoice. */
export class EditReceivableNoteDto {
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  documentDate?: string;

  @ApiPropertyOptional({ example: 1.25, minimum: 0.00000001 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  exchangeRate?: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  externalReference?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** What can change on a posted receipt. Its amount stays - void it and record it again to change that. */
export class EditReceivableReceiptDto {
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  receiptDate?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cashAccountId?: string;

  @ApiPropertyOptional({ enum: AccountingSettlementMethod })
  @IsOptional()
  @IsEnum(AccountingSettlementMethod)
  settlementMethod?: AccountingSettlementMethod;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  externalReference?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  reason?: string;
}
