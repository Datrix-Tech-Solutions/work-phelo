import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsInt,
  MinLength,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BranchImportRowDto {
  @ApiPropertyOptional({
    description:
      "The row's original position in the uploaded spreadsheet, echoed back in results so the UI can match them up.",
  })
  @IsOptional()
  @IsInt()
  rowNumber?: number;

  @ApiProperty({ description: 'Branch name', example: 'Accra Office' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ description: 'Short code for the branch' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Country' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Street address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Region or state' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Contact email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description:
      "Branch manager's full name (First Last). Left blank if not found or ambiguous.",
  })
  @IsOptional()
  @IsString()
  managerName?: string;

  @ApiPropertyOptional({ description: 'Whether this is the head office' })
  @IsOptional()
  @IsBoolean()
  isHeadOffice?: boolean;
}

export class BulkImportBranchesDto {
  @ApiProperty({ type: [BranchImportRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BranchImportRowDto)
  rows!: BranchImportRowDto[];
}
