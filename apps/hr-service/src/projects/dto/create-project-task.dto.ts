import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ProjectTaskPriority } from '../../../prisma/generated/client';

export class CreateProjectTaskDto {
  @ApiProperty({ example: 'Prepare payroll approval copy' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: 'Draft the notification copy for approvers.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-05-22' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    enum: ProjectTaskPriority,
    example: ProjectTaskPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(ProjectTaskPriority)
  priority?: ProjectTaskPriority;

  @ApiPropertyOptional({ example: '05ba7933-1078-4409-8242-95a08540a9d5' })
  @IsOptional()
  @IsUUID()
  assignedEmployeeId?: string;

  @ApiPropertyOptional({
    description: 'Workflow stage; defaults to the first stage',
  })
  @IsOptional()
  @IsString()
  stage?: string;

  @ApiPropertyOptional({
    description: "A work type name from the project's set-up",
  })
  @IsOptional()
  @IsString()
  workType?: string;

  @ApiPropertyOptional({
    description: "A priority level name from the project's set-up",
  })
  @IsOptional()
  @IsString()
  priorityName?: string;

  @ApiPropertyOptional({ description: 'Whether time is tracked on the task' })
  @IsOptional()
  @IsBoolean()
  isTimed?: boolean;

  @ApiPropertyOptional({ description: 'Objective the task belongs to' })
  @IsOptional()
  @IsUUID()
  objectiveId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Everyone the task is assigned to',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assigneeIds?: string[];
}
