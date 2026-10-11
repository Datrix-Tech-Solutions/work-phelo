import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_PAGE_SIZE, REPORT_TYPES, ReportType } from '../report-engine';
import { ReportBlockDto } from './report-block.dto';
import { ReportPeriodDto } from './report-period.dto';

export class RunReportDto {
  @ApiProperty({ enum: REPORT_TYPES })
  @IsIn(REPORT_TYPES)
  type!: ReportType;

  @ApiProperty({ type: ReportBlockDto })
  @ValidateNested()
  @Type(() => ReportBlockDto)
  block!: ReportBlockDto;

  @ApiPropertyOptional({ type: ReportPeriodDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReportPeriodDto)
  period?: ReportPeriodDto;

  @ApiPropertyOptional({ example: 1, description: 'Table blocks only.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 50, description: 'Table blocks only.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;
}
