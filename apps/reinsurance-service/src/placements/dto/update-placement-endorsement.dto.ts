import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementEndorsementType } from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class UpdatePlacementEndorsementDto {
  @ApiPropertyOptional({
    enum: PlacementEndorsementType,
    example: PlacementEndorsementType.PREMIUM_ADJUSTMENT,
  })
  @IsOptional()
  @IsEnum(PlacementEndorsementType)
  type?: PlacementEndorsementType;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-06-04T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional({
    example: 'Updated endorsement reason.',
    maxLength: 500,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    example: 'Updated proposed adjustment notes.',
    maxLength: 2000,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Replacement structured change summary.',
  })
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  changeSummary?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    description: 'Replacement proposed endorsement version data.',
  })
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  proposedSnapshot?: Record<string, unknown>;
}
