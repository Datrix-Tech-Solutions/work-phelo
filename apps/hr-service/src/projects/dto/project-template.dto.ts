import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProjectConfigDto } from './project-config.dto';

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
}
