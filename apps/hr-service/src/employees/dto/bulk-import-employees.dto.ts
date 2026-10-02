import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsEmail,
  IsNumber,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EmployeeCompensationType,
  EmploymentType,
  Gender,
} from '../../../prisma/generated/client';

export class EmployeeImportRowDto {
  @ApiPropertyOptional({
    description:
      "The row's original position in the uploaded spreadsheet, echoed back in results so the UI can match them up.",
  })
  @IsOptional()
  @IsInt()
  rowNumber?: number;

  @ApiProperty({ example: 'Ama' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Boateng' })
  @IsString()
  lastName!: string;

  @ApiProperty({ example: 'ama.boateng@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '0244000000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'FEMALE' })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({
    description:
      'Exact name of an existing department, or one created earlier in the same import.',
    example: 'Human Resources',
  })
  @IsString()
  departmentName!: string;

  @ApiPropertyOptional({
    description:
      'Exact name of an existing branch, or one created earlier in the same import. Left blank if not found.',
  })
  @IsOptional()
  @IsString()
  branchName?: string;

  @ApiProperty({ example: 'HR Officer' })
  @IsString()
  jobTitle!: string;

  @ApiPropertyOptional({
    description:
      "Reporting manager's full name (First Last). Left blank if not found or ambiguous.",
  })
  @IsOptional()
  @IsString()
  managerName?: string;

  @ApiProperty({ example: '2026-01-15' })
  @IsDateString()
  hireDate!: string;

  @ApiProperty({ example: 'FULL_TIME' })
  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @ApiPropertyOptional({
    description: 'Only applies when Employment Type is CONTRACT or INTERN',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @ApiPropertyOptional({ example: 'SALARY' })
  @IsOptional()
  @IsEnum(EmployeeCompensationType)
  compensationType?: EmployeeCompensationType;

  @ApiPropertyOptional({ example: 4500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  basicSalary?: number;
}

export class BulkImportEmployeesDto {
  @ApiProperty({ type: [EmployeeImportRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EmployeeImportRowDto)
  rows!: EmployeeImportRowDto[];
}
