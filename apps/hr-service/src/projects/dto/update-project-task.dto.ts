import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  ProjectTaskPriority,
  ProjectTaskStatus,
} from '../../../prisma/generated/client';

export class UpdateProjectTaskDto {
  @ApiPropertyOptional({ example: 'Prepare payroll approval copy' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({
    example: 'Draft the notification copy for approvers.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ProjectTaskStatus })
  @IsOptional()
  @IsEnum(ProjectTaskStatus)
  status?: ProjectTaskStatus;

  @ApiPropertyOptional({ enum: ProjectTaskPriority })
  @IsOptional()
  @IsEnum(ProjectTaskPriority)
  priority?: ProjectTaskPriority;

  @ApiPropertyOptional({ example: '2026-05-22' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    example: '05ba7933-1078-4409-8242-95a08540a9d5',
    nullable: true,
  })
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

  @ApiPropertyOptional({
    description: 'Objective the task belongs to; null takes it out',
    nullable: true,
  })
  @ValidateIf((o: UpdateProjectTaskDto) => o.objectiveId !== null)
  @IsOptional()
  @IsUUID()
  objectiveId?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description: 'Everyone the task is assigned to',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assigneeIds?: string[];
}
