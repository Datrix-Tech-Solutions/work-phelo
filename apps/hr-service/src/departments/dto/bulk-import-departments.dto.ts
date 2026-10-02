import {
  IsString,
  IsOptional,
  IsInt,
  MinLength,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DepartmentImportRowDto {
  @ApiPropertyOptional({
    description:
      "The row's original position in the uploaded spreadsheet, echoed back in results so the UI can match them up.",
  })
  @IsOptional()
  @IsInt()
  rowNumber?: number;

  @ApiProperty({ description: 'Department name', example: 'Human Resources' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ description: 'Optional department description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      "Department head's full name (First Last). Left blank if not found or ambiguous.",
  })
  @IsOptional()
  @IsString()
  managerName?: string;

  @ApiPropertyOptional({
    description:
      'Exact name of an existing branch (or one created earlier in the same import). Defaults to the head office when omitted or unresolved.',
  })
  @IsOptional()
  @IsString()
  branchName?: string;
}

export class BulkImportDepartmentsDto {
  @ApiProperty({ type: [DepartmentImportRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DepartmentImportRowDto)
  rows!: DepartmentImportRowDto[];
}
