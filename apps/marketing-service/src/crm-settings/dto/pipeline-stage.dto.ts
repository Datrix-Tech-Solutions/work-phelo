import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CollapseWhitespaceString,
  OptionalCollapseWhitespaceString,
} from './string.transforms';

export class CreatePipelineStageDto {
  @ApiProperty({ example: 'Qualified', maxLength: 120 })
  @CollapseWhitespaceString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    example: 40,
    minimum: 0,
    maximum: 100,
    description: 'Probability of achieving sales for this stage.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  probability!: number;

  @ApiPropertyOptional({
    example: 'Prospect has been qualified for active selling.',
    maxLength: 500,
  })
  @OptionalCollapseWhitespaceString()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: 0,
    minimum: 0,
    description:
      'Optional display position. Lists are ordered by displayOrder, then name.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePipelineStageDto {
  @ApiPropertyOptional({ example: 'Qualified', maxLength: 120 })
  @CollapseWhitespaceString()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: 40,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @ApiPropertyOptional({
    example: 'Prospect has been qualified for active selling.',
    maxLength: 500,
    nullable: true,
  })
  @OptionalCollapseWhitespaceString()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryPipelineStagesDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Filter active/inactive stages. Archived records are hidden.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}

export class PipelineStageResponseDto {
  @ApiProperty({ example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585' })
  id!: string;

  @ApiProperty({ example: 'Qualified' })
  name!: string;

  @ApiProperty({ example: 40 })
  probability!: number;

  @ApiPropertyOptional({
    example: 'Prospect has been qualified for active selling.',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-09-24T15:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-24T15:00:00.000Z' })
  updatedAt!: Date;
}

export class PipelineStagesListResponseDto {
  @ApiProperty({ type: [PipelineStageResponseDto] })
  items!: PipelineStageResponseDto[];
}
