import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BankReconciliationStatus } from '../../../prisma/generated/client';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const uppercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === ''
    ? undefined
    : trimmed({ value });

export const MAX_STATEMENT_LINES = 5000;

/** One row of the bank statement as the user brought it to the reconcile page. */
export class ReconciledStatementLineDto {
  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  transactionDate!: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  valueDate?: string;

  @ApiProperty({
    example: 250,
    description:
      'Signed amount in the account currency: money in is positive, money out is negative.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  amount!: number;

  @ApiPropertyOptional({ example: 'GHS' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(160)
  bankReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(160)
  counterpartyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  runningBalance?: number;

  @ApiPropertyOptional({
    minimum: 1,
    description:
      'The group this row was reconciled in. Omit for a row left unreconciled.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  matchGroup?: number;
}

export class ReconciledEntryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  journalLineId!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  matchGroup!: number;
}

export class CompleteBankReconciliationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cashAccountId!: string;

  @ApiPropertyOptional({
    example: 'ECOBANK-2026-08',
    description: 'Generated from the period when left out.',
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(160)
  statementReference?: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  statementStartDate!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  statementEndDate!: string;

  @ApiProperty({ example: 1000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  openingBalance!: number;

  @ApiProperty({ example: 1250 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  closingBalance!: number;

  @ApiProperty({ example: 'GHS', minLength: 3, maxLength: 3 })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({
    type: () => [ReconciledStatementLineDto],
    description:
      'Every statement row the user brought, matched or not. Only these values are stored; no file is.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_STATEMENT_LINES)
  @ValidateNested({ each: true })
  @Type(() => ReconciledStatementLineDto)
  statementLines!: ReconciledStatementLineDto[];

  @ApiProperty({
    type: () => [ReconciledEntryDto],
    description:
      'Ledger lines of the cash account the user ticked off, each with its group. Within every group the ledger total must equal the statement rows total.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_STATEMENT_LINES)
  @ValidateNested({ each: true })
  @Type(() => ReconciledEntryDto)
  reconciledEntries!: ReconciledEntryDto[];
}

export class QueryBankReconciliationsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cashAccountId?: string;

  @ApiPropertyOptional({ enum: BankReconciliationStatus })
  @IsOptional()
  @IsEnum(BankReconciliationStatus)
  status?: BankReconciliationStatus;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class ReconciledEntriesQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cashAccountId!: string;
}
