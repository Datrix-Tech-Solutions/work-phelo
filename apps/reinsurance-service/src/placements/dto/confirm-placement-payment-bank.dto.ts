import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class ConfirmPlacementPaymentBankDto {
  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-06-04T14:30:00.000Z',
    description:
      'Accounting-owned date/time when the bank completed the outbound reinsurer disbursement.',
  })
  @IsDateString()
  bankConfirmedAt!: string;

  @ApiProperty({
    example: 'BANK-CONF-2026-001',
    maxLength: 100,
    description: 'Bank confirmation/reference supplied by Accounting.',
  })
  @TrimmedString()
  @IsString()
  @MaxLength(100)
  bankReference!: string;

  @ApiPropertyOptional({
    example: 12.345678,
    minimum: 0.000001,
    description:
      'Agreed transaction FX rate, required by policy when settlement currency differs from the obligation currency.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.000001)
  agreedExchangeRate?: number;

  @ApiPropertyOptional({
    example: 25,
    minimum: 0,
    description:
      'Bank charges captured during Accounting confirmation. Accounting determines final ledger posting treatment.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  bankChargeAmount?: number;

  @ApiPropertyOptional({
    example: 50,
    minimum: 0,
    description:
      'Withholding tax captured during Accounting confirmation. Accounting determines final ledger posting treatment.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  withholdingTaxAmount?: number;

  @ApiPropertyOptional({
    example: 'Confirmed from bank statement batch 2026-06-04.',
    maxLength: 1000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
