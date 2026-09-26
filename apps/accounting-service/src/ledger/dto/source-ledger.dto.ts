import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountingSettlementMethod } from '../../../prisma/generated/client';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class QuerySourceLedgerDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sourceTypeId?: string;
}

export class MakeSourceLedgerPaymentDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Cash/bank account the payment is made from.',
  })
  @IsUUID()
  cashAccountId!: string;

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
