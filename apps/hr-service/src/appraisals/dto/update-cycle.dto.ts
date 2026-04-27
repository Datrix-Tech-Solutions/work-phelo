import { IsString, IsDateString, IsOptional, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAppraisalCycleDto {
  @ApiPropertyOptional({ description: 'Cycle title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Optional description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Cycle start date',
    example: '2026-07-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Cycle end date', example: '2026-07-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

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

  @ApiPropertyOptional({ description: 'Appraisal template ID' })
  @IsOptional()
  @IsString()
  templateId?: string;
}
