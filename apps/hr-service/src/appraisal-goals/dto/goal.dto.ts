import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { GoalObjectiveInputDto } from './objective.dto';

export class CreateAppraisalGoalDto {
  @ApiProperty({ example: 'Customer satisfaction' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    description:
      "Share of an objective's score that comes from the employee; the manager's share is the rest.",
    minimum: 0,
    maximum: 100,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  selfAssessmentWeight!: number;

  @ApiPropertyOptional({ description: 'Employees the goal is for' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  employeeIds?: string[];

  @ApiPropertyOptional({
    type: [GoalObjectiveInputDto],
    description:
      'New objectives to set with the goal, each given to its own employees on it. Saved together with the goal.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => GoalObjectiveInputDto)
  objectives?: GoalObjectiveInputDto[];
}

export class UpdateAppraisalGoalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  selfAssessmentWeight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  employeeIds?: string[];

  @ApiPropertyOptional({
    type: [GoalObjectiveInputDto],
    description:
      'New objectives to set with the goal, each given to its own employees on it. Saved together with the goal.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => GoalObjectiveInputDto)
  objectives?: GoalObjectiveInputDto[];
}
