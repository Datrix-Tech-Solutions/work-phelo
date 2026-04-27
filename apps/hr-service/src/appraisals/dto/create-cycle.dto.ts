import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppraisalCycleDto {
  @ApiProperty({
    description: 'Cycle title',
    example: 'Midyear Performance Review',
  })
  @IsString()
  title!: string;

  @ApiPropertyOptional({
    description: 'Optional cycle description',
    example: 'Review employee goals and performance for H1',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Cycle start date', example: '2026-07-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: 'Cycle end date', example: '2026-07-31' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({
    description: 'Self-assessment deadline',
    example: '2026-07-15',
  })
  @IsOptional()
  @IsDateString()
  selfAssessmentDeadline?: string;

  @ApiPropertyOptional({
    description: 'Manager review deadline',
    example: '2026-07-25',
  })
  @IsOptional()
  @IsDateString()
  managerReviewDeadline?: string;

  @ApiPropertyOptional({ description: 'Frequency', example: 'Annual' })
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional({
    description: 'Department IDs to restrict cycle',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departmentIds?: string[];

  @ApiPropertyOptional({
    description:
      'Employment types to include — FULL_TIME, PART_TIME, CONTRACT, INTERN. Defaults to all when empty.',
    type: [String],
    enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'], { each: true })
  employmentTypes?: string[];

  @ApiPropertyOptional({
    description:
      'Explicit employee IDs to include. When set, departmentIds and employmentTypes are ignored.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  employeeIds?: string[];

  @ApiPropertyOptional({ description: 'Appraisal template ID' })
  @IsOptional()
  @IsString()
  templateId?: string;
}
