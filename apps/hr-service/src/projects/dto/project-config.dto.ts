import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProjectBillingType } from '../../../prisma/generated/client';

export const WORK_TYPE_ICONS = [
  'EPIC',
  'STORY',
  'TASK',
  'BUG',
  'IMPROVEMENT',
  'FEATURE',
  'SUBTASK',
] as const;

export const PRIORITY_COLORS = [
  'GRAY',
  'BLUE',
  'GREEN',
  'YELLOW',
  'ORANGE',
  'RED',
  'PURPLE',
] as const;

export const PROJECT_FEATURES = [
  'OBJECTIVES',
  'BOARD',
  'BACKLOG',
  'CALENDAR',
  'LIST',
] as const;

export class WorkTypeDto {
  @ApiProperty({ example: 'Story' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: WORK_TYPE_ICONS })
  @IsIn(WORK_TYPE_ICONS)
  icon!: (typeof WORK_TYPE_ICONS)[number];
}

export class PriorityLevelDto {
  @ApiProperty({ example: 'Critical' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: PRIORITY_COLORS })
  @IsIn(PRIORITY_COLORS)
  color!: (typeof PRIORITY_COLORS)[number];
}

/** The workflow, work types, features and priority levels a project runs on. */
export class ProjectConfigDto {
  @ApiProperty({ type: [String], example: ['To Do', 'In Progress', 'Done'] })
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  workflow!: string[];

  @ApiProperty({ type: [WorkTypeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkTypeDto)
  workTypes!: WorkTypeDto[];

  @ApiProperty({ enum: PROJECT_FEATURES, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(PROJECT_FEATURES, { each: true })
  features!: (typeof PROJECT_FEATURES)[number][];

  @ApiProperty({ type: [PriorityLevelDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PriorityLevelDto)
  priorities!: PriorityLevelDto[];
}

export class MilestoneDto {
  @ApiProperty({ example: 'Design sign-off' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

/** What a billable client project charges. Which fields apply depends on `type`. */
export class ProjectPricingDto {
  @ApiProperty({ enum: ProjectBillingType })
  @IsEnum(ProjectBillingType)
  type!: ProjectBillingType;

  @ApiPropertyOptional({ description: 'FLAT_RATE: the fixed price' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number;

  @ApiPropertyOptional({ description: 'TIMED: rate per hour' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  hourlyRate?: number;

  @ApiPropertyOptional({
    description: 'TIMED: hours estimated, for the expected value',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedHours?: number;

  @ApiPropertyOptional({ description: 'RETAINER: amount per month' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  monthlyAmount?: number;

  @ApiPropertyOptional({
    type: [MilestoneDto],
    description: 'MILESTONE: the payments due',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneDto)
  milestones?: MilestoneDto[];
}
