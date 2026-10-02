import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountingSettlementMethod } from '../../../prisma/generated/client';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export type SourceLedgerStatusFilter = 'ALL' | 'PAID' | 'UNPAID';
export type SourceLedgerSortBy = 'eventDate' | 'paymentDate';
export type SourceLedgerSortDir = 'asc' | 'desc';

export class QuerySourceLedgerDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sourceTypeId?: string;

  @ApiPropertyOptional({
    enum: ['ALL', 'PAID', 'UNPAID'],
    default: 'ALL',
    description: 'UNPAID covers both OPEN and PARTIALLY_PAID.',
  })
  @IsOptional()
  @IsEnum(['ALL', 'PAID', 'UNPAID'])
  status?: SourceLedgerStatusFilter;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    enum: ['eventDate', 'paymentDate'],
    default: 'eventDate',
    description:
      "paymentDate sorts by each entry's most recent payment — entries with none sort last.",
  })
  @IsOptional()
  @IsEnum(['eventDate', 'paymentDate'])
  sortBy?: SourceLedgerSortBy;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: SourceLedgerSortDir;

  @ApiPropertyOptional({
    description:
      'Caps the number of entries returned, most-recent-first application of sortBy/sortDir.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class QuerySourceLedgerSummaryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sourceTypeId!: string;
}

export class MakeSourceLedgerPaymentDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Cash/bank account the payment is made from.',
  })
  @IsUUID()
  cashAccountId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The Receivable/Payable Transaction Type (flagged postsToCashbook) this direct ' +
      'transaction is made under. Its code drives the generated transaction number ' +
      '(e.g. RCPT26-00001); omit it and the entry gets no number.',
  })
  @IsOptional()
  @IsUUID()
  transactionTypeId?: string;

  @ApiProperty({
    example: 2736.87,
    minimum: 0.0001,
    description:
      "May be less than the entry's outstanding balance for a partial payment.",
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amount!: number;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  transactionDate!: string;

  @ApiProperty({ enum: AccountingSettlementMethod })
  @IsEnum(AccountingSettlementMethod)
  settlementMethod!: AccountingSettlementMethod;

  @ApiPropertyOptional({
    description: 'Defaults to a description built from the entry itself.',
  })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  description?: string;
}
