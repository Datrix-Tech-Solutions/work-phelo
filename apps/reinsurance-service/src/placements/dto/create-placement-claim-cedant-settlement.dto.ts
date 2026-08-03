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

export class CreatePlacementClaimCedantSettlementDto {
  @ApiProperty({ example: 'GHS', minLength: 3, maxLength: 3 })
  @TrimmedString()
  @IsString()
  @MaxLength(3)
  currency!: string;

  @ApiProperty({ example: 25000, minimum: 0.01 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-07-29T12:00:00.000Z',
  })
  @IsDateString()
  settlementDate!: string;

  @ApiPropertyOptional({ example: 'CEDANT-PAY-001', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({
    example: 'Partial settlement paid to cedant.',
    maxLength: 1000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
