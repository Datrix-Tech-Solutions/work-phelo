import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProjectTaskStatus } from '../../../prisma/generated/client';

export class UpdateTaskStatusDto {
  @ApiPropertyOptional({ enum: ProjectTaskStatus })
  @IsOptional()
  @IsEnum(ProjectTaskStatus)
  status?: ProjectTaskStatus;

  @ApiPropertyOptional({
    description: 'A workflow stage of the project; the status follows it',
  })
  @IsOptional()
  @IsString()
  stage?: string;
}
