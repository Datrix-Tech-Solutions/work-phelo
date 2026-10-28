import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
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

/** Keeps only the names given to real features, trimmed and of a sensible length. */
export function featureLabelsFrom(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([key, label]) =>
          (PROJECT_FEATURES as readonly string[]).includes(key) &&
          typeof label === 'string' &&
          label.trim().length > 0,
      )
      .map(([key, label]) => [key, (label as string).trim().slice(0, 40)]),
  );
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

  @ApiPropertyOptional({
    description: 'Names given to features, by feature; others keep their own',
    example: { BACKLOG: 'Sprints' },
  })
  @IsOptional()
  @Transform(({ value }) => featureLabelsFrom(value))
  @IsObject()
  featureLabels?: Partial<Record<(typeof PROJECT_FEATURES)[number], string>>;

  @ApiPropertyOptional({
    enum: PROJECT_FEATURES,
    isArray: true,
    description:
      'Features added to this project after it was made; only these can be removed again',
  })
  @IsOptional()
  @IsArray()
  @IsIn(PROJECT_FEATURES, { each: true })
  addedFeatures?: (typeof PROJECT_FEATURES)[number][];
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
