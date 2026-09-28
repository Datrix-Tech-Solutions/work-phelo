import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { MarketingCrmSettingCategory } from '../../../prisma/generated/client';
import {
  CollapseWhitespaceString,
  OptionalCollapseWhitespaceString,
} from './string.transforms';

export class CreateProspectingSettingDto {
  @ApiProperty({ example: 'Referral', maxLength: 120 })
  @CollapseWhitespaceString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    example: 'Prospects introduced by an existing customer or partner.',
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

export class UpdateProspectingSettingDto {
  @ApiPropertyOptional({ example: 'Referral', maxLength: 120 })
  @CollapseWhitespaceString()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: 'Prospects introduced by an existing customer or partner.',
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

export class QueryProspectingSettingsDto {
  @ApiPropertyOptional({
    example: true,
    description:
      'Filter active/inactive settings. Archived records are hidden.',
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

export class ProspectingSettingResponseDto {
  @ApiProperty({ example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585' })
  id!: string;

  @ApiProperty({ enum: MarketingCrmSettingCategory })
  category!: MarketingCrmSettingCategory;

  @ApiProperty({ example: 'Referral' })
  name!: string;

  @ApiPropertyOptional({
    example: 'Prospects introduced by an existing customer or partner.',
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

export class ProspectingSettingsListResponseDto {
  @ApiProperty({ type: [ProspectingSettingResponseDto] })
  items!: ProspectingSettingResponseDto[];
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Validation failed' })
  message!: string | string[];

  @ApiPropertyOptional({ example: 'Bad Request' })
  error?: string;
}
