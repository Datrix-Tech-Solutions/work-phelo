import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class GroupGoalDto {
  @ApiProperty()
  @IsUUID()
  goalId!: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  weight!: number;
}

export class CreateAppraisalGroupDto {
  @ApiProperty({ example: 'Marketing' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  employeeIds!: string[];

  @ApiProperty({
    type: [GroupGoalDto],
    description: 'The goals that count for this group; the weights total 100',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GroupGoalDto)
  goals!: GroupGoalDto[];
}

export class UpdateAppraisalGroupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  employeeIds?: string[];

  @ApiPropertyOptional({ type: [GroupGoalDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GroupGoalDto)
  goals?: GroupGoalDto[];
}
