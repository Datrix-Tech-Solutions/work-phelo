import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
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
