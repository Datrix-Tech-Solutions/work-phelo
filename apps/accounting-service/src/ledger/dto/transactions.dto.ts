import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const TRANSACTION_LIST_TYPES = [
  'RECEIVABLE',
  'PAYABLE',
  'CASHBOOK',
  'TRANSFER',
] as const;

export class QueryTransactionsDto {
  @ApiPropertyOptional({
    enum: TRANSACTION_LIST_TYPES,
    description:
      'RECEIVABLE: invoices and customer credit notes. PAYABLE: bills and vendor credit notes. CASHBOOK: direct entries other than transfers. TRANSFER: bank transfers.',
  })
  @IsOptional()
  @IsIn(TRANSACTION_LIST_TYPES)
  type?: (typeof TRANSACTION_LIST_TYPES)[number];

  @ApiPropertyOptional({
    example: 'POSTED',
    description: 'Voided entries are left out unless VOIDED is asked for.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @ApiPropertyOptional({
    description:
      'Matches the number, the customer/vendor/description and the status.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only this customer/vendor/entity.',
  })
  @IsOptional()
  @IsUUID()
  partyId?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
