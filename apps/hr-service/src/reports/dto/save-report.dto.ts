import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  MAX_BLOCKS_PER_REPORT,
  REPORT_TYPES,
  ReportType,
} from '../report-engine';
import { ReportBlockDto } from './report-block.dto';
import { ReportPeriodDto } from './report-period.dto';

export class SaveReportDto {
  @ApiProperty({ example: 'Leave taken by department' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: REPORT_TYPES })
  @IsIn(REPORT_TYPES)
  type!: ReportType;

  @ApiPropertyOptional({ type: ReportPeriodDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReportPeriodDto)
  period?: ReportPeriodDto;

  @ApiProperty({
    type: [ReportBlockDto],
    description:
      'One block for a table report; one or more for a chart report.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BLOCKS_PER_REPORT)
  @ValidateNested({ each: true })
  @Type(() => ReportBlockDto)
  blocks!: ReportBlockDto[];
}
