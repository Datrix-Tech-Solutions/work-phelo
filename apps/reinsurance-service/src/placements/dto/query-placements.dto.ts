import { Type } from 'class-transformer';
import {
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
import {
  PlacementStatus,
  PlacementType,
} from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

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
