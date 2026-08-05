import { Type } from 'class-transformer';
import {
  IsISO4217CurrencyCode,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class ApprovePlacementClaimPayableDto {
  @ApiProperty({
    example: 37500,
    minimum: 0.01,
    description:
      'Reinsurer-final approved amount payable to the cedant. Must match claim currency and cannot exceed finalLossAmount.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  approvedPayableAmount!: number;

  @ApiPropertyOptional({
    example: 'GHS',
    description:
      'Optional claim currency echo. When supplied, it must match the claim currency.',
  })
  @TrimmedString()
  @IsOptional()
  @IsISO4217CurrencyCode()
  currency?: string;

  @ApiPropertyOptional({
    example: 'Approved after adjuster final loss review.',
    maxLength: 1000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
