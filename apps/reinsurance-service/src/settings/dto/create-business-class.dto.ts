import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  TrimmedString,
  UppercaseTrimmedString,
} from '../../counterparties/dto/string.transforms';

export class CreateBusinessClassDto {
  @ApiProperty({ example: 'Motor', minLength: 2, maxLength: 100 })
  @TrimmedString()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'MOTOR',
    description:
      'Unique code used as classOfBusiness in placements. Uppercase, alphanumeric with optional underscores or hyphens.',
    minLength: 2,
    maxLength: 50,
    pattern: '^[A-Z0-9][A-Z0-9_-]*$',
  })
  @UppercaseTrimmedString()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[A-Z0-9][A-Z0-9_-]*$/, {
    message:
      'code must be uppercase alphanumeric with optional underscores or hyphens, starting with a letter or digit',
  })
  code!: string;

  @ApiPropertyOptional({
    example: 'Motor vehicle insurance class of business.',
    maxLength: 500,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
