import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AccountingSettlementMethod } from '../../../prisma/generated/client';
import { CashbookEntryLineDto } from './cashbook.dto';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const uppercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** Why a draft is being turned down. It is kept on the record and shown to whoever raised it. */
export class RejectDraftDto {
  @ApiProperty({ example: 'Wrong entity for this client', maxLength: 500 })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

/**
 * What can still be changed on a draft invoice. The amount, quantity, unit price, entity and
 * transaction type are deliberately not here - they were fixed when the draft was raised, and the
 * request validation rejects any attempt to send them.
 */
export class UpdateReceivableInvoiceDraftDto {
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  documentDate?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 'GHS', minLength: 3, maxLength: 3 })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 1.25, minimum: 0.00000001 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  exchangeRate?: number;

  @ApiPropertyOptional({
    type: [String],
    description:
      'The tax lines of the type’s rule to apply, by tax type id. Replaces the current selection; an empty list removes all tax.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  selectedTaxTypeIds?: string[];

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Null clears the cost centre.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  costCentreId?: string | null;

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
}

/** What can still be changed on a draft cashbook entry. Its amount only changes by replacing its lines. */
export class UpdateCashbookDraftDto {
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cashAccountId?: string;

  @ApiPropertyOptional({ enum: AccountingSettlementMethod })
  @IsOptional()
  @IsEnum(AccountingSettlementMethod)
  settlementMethod?: AccountingSettlementMethod;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The account the entry credits (receipt) or debits (payment).',
  })
  @IsOptional()
  @IsUUID()
  offsetGlAccountId?: string;

  @ApiPropertyOptional({
    type: [CashbookEntryLineDto],
    description:
      'Replaces every line of the draft; the entry amount becomes the net cash (items plus charges minus deductions). Cannot be combined with offsetGlAccountId.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CashbookEntryLineDto)
  lines?: CashbookEntryLineDto[];

  @ApiPropertyOptional({ example: 1.25, minimum: 0.00000001 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  exchangeRate?: number;

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
  @IsNotEmpty()
  @MaxLength(500)
  description?: string;
}

/**
 * Edits to a posted direct receipt, payment or contra transaction while its period is open. The
 * entry keeps its number, type and currency; everything else on the form can change. Send `null`
 * to clear the entity (or the charge on a contra transaction).
 */
export class EditPostedCashbookDto extends UpdateCashbookDraftDto {
  @ApiPropertyOptional({ nullable: true, example: 'CUSTOMER' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  counterpartyType?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  counterpartyId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Contra transactions only: the account the money goes to.',
  })
  @IsOptional()
  @IsUUID()
  destinationCashAccountId?: string;

  @ApiPropertyOptional({ description: 'Contra transactions only.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amount?: number;

  @ApiPropertyOptional({ nullable: true, description: 'Contra only.' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  chargeAmount?: number | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Contra only.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  chargeGlAccountId?: string | null;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  reason?: string;
}
