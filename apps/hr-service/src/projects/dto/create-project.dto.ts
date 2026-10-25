import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
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
import { ProjectKind } from '../../../prisma/generated/client';
import { ProjectConfigDto, ProjectPricingDto } from './project-config.dto';

export class CreateProjectDto {
  @ApiProperty({ example: 'Payroll self-service rollout' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: 'Roll out employee payslip and payroll approval improvements.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-05-15' })
  @IsDateString()
  startDate!: string;

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
  })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiProperty({ enum: ProjectKind })
  @IsEnum(ProjectKind)
  kind!: ProjectKind;

  @ApiPropertyOptional({
    description: 'Template the project started from; omit for a blank slate',
  })
  @IsOptional()
  @IsString()
  templateName?: string;

  @ApiProperty({ type: ProjectConfigDto })
  @ValidateNested()
  @Type(() => ProjectConfigDto)
  config!: ProjectConfigDto;

  @ApiPropertyOptional({
    description: 'Marketing client a client project is for',
  })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'The client name as shown now' })
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiPropertyOptional({ description: 'Whether a client project is billed' })
  @IsOptional()
  @IsBoolean()
  billable?: boolean;

  @ApiPropertyOptional({ type: ProjectPricingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProjectPricingDto)
  pricing?: ProjectPricingDto;
}
