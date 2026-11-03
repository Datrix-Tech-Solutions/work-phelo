import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateAppraisalObjectiveDto {
  @ApiPropertyOptional({
    description: "Whose objective it is; defaults to the caller's own",
  })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({
    description:
      'The goal it counts towards. Can be left out and linked later.',
  })
  @IsOptional()
  @IsUUID()
  goalId?: string;

  @ApiProperty({ example: 'Close 20 support tickets a week' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  comments?: string[];
}

export class LinkAppraisalObjectiveDto {
  @ApiPropertyOptional({
    description: 'The goal to link to; null or omitted unlinks it',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  goalId?: string | null;
}

export class AddObjectiveCommentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body!: string;
}

/** One objective and the employees it is given to; each objective has its own set of people. */
export class GoalObjectiveInputDto {
  @ApiProperty({ example: 'Close 20 support tickets a week' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({
    type: [String],
    description: 'Employees it is given to; they must be on the goal',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(1000)
  @IsUUID('4', { each: true })
  employeeIds!: string[];
}

export class CreateGoalObjectivesDto {
  @ApiProperty()
  @IsUUID()
  goalId!: string;

  @ApiProperty({ type: [GoalObjectiveInputDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => GoalObjectiveInputDto)
  objectives!: GoalObjectiveInputDto[];
}
