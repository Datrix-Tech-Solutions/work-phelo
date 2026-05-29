import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  BusinessClassFieldSection,
  BusinessClassFieldType,
} from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class CreateBusinessClassFieldDto {
  @ApiProperty({
    enum: BusinessClassFieldSection,
    example: BusinessClassFieldSection.BUSINESS_DETAILS,
  })
  @IsEnum(BusinessClassFieldSection)
  section!: BusinessClassFieldSection;

  @ApiProperty({
    example: 'vehicle_make',
    description:
      'JSON-safe key: lowercase alphanumeric and underscores, starting with a letter.',
    minLength: 1,
    maxLength: 60,
    pattern: '^[a-z][a-z0-9_]*$',
  })
  @TrimmedString()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message:
      'fieldKey must be lowercase alphanumeric with underscores, starting with a letter',
  })
  fieldKey!: string;

  @ApiProperty({ example: 'Vehicle Make', minLength: 1, maxLength: 100 })
  @TrimmedString()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label!: string;

  @ApiProperty({
    enum: BusinessClassFieldType,
    example: BusinessClassFieldType.TEXT,
  })
  @IsEnum(BusinessClassFieldType)
  fieldType!: BusinessClassFieldType;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: ['Toyota', 'Honda', 'Ford'],
    description: 'Required when fieldType is SELECT.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({
    type: Object,
    example: { min: 0, max: 100 },
    description: 'Arbitrary validation hints (min, max, pattern, etc.).',
  })
  @IsOptional()
  @IsObject()
  validationRules?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'e.g. Toyota', maxLength: 200 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeholder?: string;

  @ApiPropertyOptional({
    example: 'Enter the vehicle make as shown on the registration.',
    maxLength: 500,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  helpText?: string;

  @ApiPropertyOptional({ example: 0, minimum: 0, default: 0 })
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
