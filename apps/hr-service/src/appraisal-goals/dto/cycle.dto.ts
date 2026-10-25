import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const FREQUENCIES = ['ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'AD_HOC'] as const;

export class CreateGoalCycleDto {
  @ApiProperty({ example: '2026 Annual Review' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: FREQUENCIES })
  @IsOptional()
  @IsIn(FREQUENCIES)
  frequency?: string;

  @ApiProperty({
    description: 'May be in the past; objectives linked from this day count',
    example: '2026-10-01',
  })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-12-31' })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ example: '2026-12-10' })
  @IsDateString()
  selfAssessmentDeadline!: string;

  @ApiProperty({ example: '2026-12-20' })
  @IsDateString()
  managerReviewDeadline!: string;

  @ApiProperty({ description: 'Goals the cycle runs', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  goalIds!: string[];
}

/** Before the cycle starts anything can change. Afterwards only the name and description. */
export class UpdateGoalCycleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: FREQUENCIES })
  @IsOptional()
  @IsIn(FREQUENCIES)
  frequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  selfAssessmentDeadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  managerReviewDeadline?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  goalIds?: string[];
}

export class ObjectiveRatingDto {
  @ApiProperty()
  @IsUUID()
  objectiveId!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class SubmitObjectiveRatingsDto {
  @ApiProperty({ type: [ObjectiveRatingDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ObjectiveRatingDto)
  ratings!: ObjectiveRatingDto[];

  @ApiPropertyOptional({ description: "The manager's overall comment" })
  @IsOptional()
  @IsString()
  comment?: string;
}
