import {
  IsString,
  IsInt,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TemplateKpiDto {
  @ApiProperty({ description: 'KPI title' })
  @IsString()
  title!: string;

  @ApiProperty({ description: 'Weight (0-100)' })
  @IsInt()
  @Min(0)
  @Max(100)
  weight!: number;

  @ApiPropertyOptional({ description: 'Max score', default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxScore?: number;

  @ApiPropertyOptional({ description: 'KPI description' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateAppraisalTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: 'Self-assessment weight (0-100)',
    default: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  selfAssessmentWeight?: number;

  @ApiPropertyOptional({
    description: 'Manager assessment weight (0-100)',
    default: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  managerAssessmentWeight?: number;

  @ApiPropertyOptional({
    description: 'KPIs for this template',
    type: [TemplateKpiDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateKpiDto)
  kpis?: TemplateKpiDto[];
}
