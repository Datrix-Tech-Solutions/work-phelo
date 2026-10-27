import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProjectStatus } from '../../../prisma/generated/client';
import { ProjectConfigDto, ProjectPricingDto } from './project-config.dto';

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Payroll self-service rollout' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({
    example: 'Roll out employee payslip and payroll approval improvements.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ProjectStatus, example: ProjectStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ example: '2026-05-15' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 25000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @ApiPropertyOptional({
    description: 'Employee ID of the project manager',
    example: '05ba7933-1078-4409-8242-95a08540a9d5',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({
    type: ProjectConfigDto,
    description: "Replaces the project's own set-up, e.g. to turn on a tab",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProjectConfigDto)
  config?: ProjectConfigDto;

  @ApiPropertyOptional({
    type: ProjectPricingDto,
    description: 'Changes the price of a flat-rate project',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProjectPricingDto)
  pricing?: ProjectPricingDto;
}
