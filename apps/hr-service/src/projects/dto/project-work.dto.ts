import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class ObjectiveDto {
  @ApiProperty({ example: 'Launch readiness' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateSubtaskDto {
  @ApiProperty({ description: 'The task the subtask belongs to' })
  @IsUUID()
  taskId!: string;

  @ApiProperty({ example: 'Draft the copy' })
  @IsString()
  @MinLength(1)
  name!: string;
}

export class UpdateSubtaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}

export class SprintDto {
  @ApiProperty({ example: 'Sprint 1' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: '2026-11-02' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-11-15' })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ type: [String], description: 'The tasks in the sprint' })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  taskIds!: string[];
}

export class CompleteSprintDto {
  @ApiProperty({
    type: [String],
    description:
      'Tasks that stay in the sprint; the rest go back to the backlog',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  keepTaskIds!: string[];
}
