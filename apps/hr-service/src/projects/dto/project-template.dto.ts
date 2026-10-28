import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  PROJECT_FEATURES,
  ProjectConfigDto,
  featureLabelsFrom,
} from './project-config.dto';

export class TemplateSprintDto {
  @ApiProperty({ example: 'Sprint 1' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    example: 14,
    description: 'How long the sprint runs, in days',
  })
  @IsInt()
  @Min(1)
  @Max(365)
  days!: number;
}

/** What a project starting from the template comes with, beyond its set-up. */
export class TemplateContentDto {
  @ApiProperty({ type: [String], example: ['Launch the campaign'] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(200, { each: true })
  objectives!: string[];

  @ApiProperty({ type: [TemplateSprintDto], description: 'In order' })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TemplateSprintDto)
  sprints!: TemplateSprintDto[];

  @ApiProperty({
    description: 'Names given to features, by feature; others keep their own',
    example: { BACKLOG: 'Sprints' },
  })
  @Transform(({ value }) => featureLabelsFrom(value))
  @IsObject()
  featureLabels!: Partial<Record<(typeof PROJECT_FEATURES)[number], string>>;
}

export class ProjectTemplateDto {
  @ApiProperty({ example: 'Website build' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: ProjectConfigDto })
  @ValidateNested()
  @Type(() => ProjectConfigDto)
  config!: ProjectConfigDto;

  @ApiPropertyOptional({
    type: TemplateContentDto,
    description: 'Left out on an update, the template keeps what it had',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TemplateContentDto)
  content?: TemplateContentDto;
}
