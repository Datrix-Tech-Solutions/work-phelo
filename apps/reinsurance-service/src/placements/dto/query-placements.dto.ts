import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TrimmedString } from '../../counterparties/dto/string.transforms';
import {
  PlacementStatus,
  PlacementType,
} from '../../../prisma/generated/client';

export class QueryPlacementsDto {
  @ApiPropertyOptional({ example: 'FAC-2026', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: PlacementStatus,
    example: PlacementStatus.MARKETING,
  })
  @IsOptional()
  @IsEnum(PlacementStatus)
  status?: PlacementStatus;

  @ApiPropertyOptional({
    enum: PlacementType,
    example: PlacementType.FACULTATIVE,
  })
  @IsOptional()
  @IsEnum(PlacementType)
  placementType?: PlacementType;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter by tenant-owned cedant counterparty.',
  })
  @IsOptional()
  @IsUUID()
  cedantId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter by risk type ID (exact match).',
  })
  @IsOptional()
  @IsUUID()
  riskTypeId?: string;

  @ApiPropertyOptional({
    example: 'Marine Cargo',
    maxLength: 100,
    description:
      'Filter by class of business name (partial match, case-insensitive). ' +
      'Use riskTypeId for exact structured filtering.',
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  classOfBusiness?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'When true, return only placements with at least one CONFIRMED placement closing.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  paymentEligible?: boolean;

  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
