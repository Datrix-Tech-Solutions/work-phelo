import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  AGGREGATIONS,
  Aggregation,
  CHART_TYPES,
  ChartType,
  GRANULARITIES,
  Granularity,
  MAX_CHART_MEASURES,
  MAX_TABLE_COLUMNS,
} from '../report-engine';

export class ReportSortDto {
  @ApiProperty({ example: 'hireDate' })
  @IsString()
  @MaxLength(64)
  field!: string;

  @ApiProperty({ enum: ['asc', 'desc'] })
  @IsIn(['asc', 'desc'])
  direction!: 'asc' | 'desc';
}

export class ReportGroupByDto {
  @ApiProperty({ example: 'department' })
  @IsString()
  @MaxLength(64)
  field!: string;

  @ApiPropertyOptional({ enum: GRANULARITIES })
  @IsOptional()
  @IsIn(GRANULARITIES)
  granularity?: Granularity;
}

export class ReportMeasureDto {
  @ApiProperty({
    example: 'totalDays',
    description:
      '"__count" counts records; otherwise a number field of the dataset.',
  })
  @IsString()
  @MaxLength(64)
  field!: string;

  @ApiProperty({ enum: AGGREGATIONS })
  @IsIn(AGGREGATIONS)
  aggregation!: Aggregation;
}

export class ReportScatterDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  x!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  y!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  label?: string;
}

export class ReportFilterDto {
  @ApiProperty({ example: 'department' })
  @IsString()
  @MaxLength(64)
  field!: string;

  @ApiProperty({ type: [String], example: ['Finance', 'Sales'] })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  values!: string[];
}

/** One table or one chart. Its rules are checked against the catalog in report-engine.ts. */
export class ReportBlockDto {
  @ApiProperty({ example: 'leave' })
  @IsString()
  @MaxLength(64)
  dataset!: string;

  @ApiPropertyOptional({ example: 'Leave days by department' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TABLE_COLUMNS)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  columns?: string[];

  @ApiPropertyOptional({ type: ReportSortDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReportSortDto)
  sort?: ReportSortDto;

  @ApiPropertyOptional({ enum: CHART_TYPES })
  @IsOptional()
  @IsIn(CHART_TYPES)
  chartType?: ChartType;

  @ApiPropertyOptional({ type: ReportGroupByDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReportGroupByDto)
  groupBy?: ReportGroupByDto;

  @ApiPropertyOptional({ type: [ReportMeasureDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CHART_MEASURES)
  @ValidateNested({ each: true })
  @Type(() => ReportMeasureDto)
  measures?: ReportMeasureDto[];

  @ApiPropertyOptional({ type: ReportScatterDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReportScatterDto)
  scatter?: ReportScatterDto;

  @ApiPropertyOptional({ type: [ReportFilterDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ReportFilterDto)
  filters?: ReportFilterDto[];
}
