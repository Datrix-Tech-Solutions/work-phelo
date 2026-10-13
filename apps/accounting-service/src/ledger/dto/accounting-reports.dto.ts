import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  IsUUID,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const uppercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class GeneralLedgerReportQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  fiscalPeriodId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  costCentreId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subledgerId?: string;

  @ApiPropertyOptional({ example: 'GHS', minLength: 3, maxLength: 3 })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency?: string;
}

export class TrialBalanceReportQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  fiscalPeriodId?: string;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  includeZeroBalances?: boolean;
}

export class IncomeStatementReportQueryDto {
  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  fromDate!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  toDate!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  fiscalPeriodId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  costCentreId?: string;
}

export class BalanceSheetReportQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  fiscalPeriodId?: string;
}

export class CashFlowReportQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  fiscalPeriodId?: string;
}

const DAY = '\\d{4}-\\d{2}-\\d{2}';
const RANGE = `${DAY}:${DAY}`;

export const INCOME_SERIES_MAX_RANGES = 12;

export class IncomeSeriesReportQueryDto {
  @ApiProperty({
    example: '2026-04-01:2026-04-30,2026-05-01:2026-05-31',
    description: `Comma-separated fromDate:toDate ranges (YYYY-MM-DD, both inclusive), at most ${INCOME_SERIES_MAX_RANGES}.`,
  })
  @IsString()
  @Matches(
    new RegExp(`^${RANGE}(,${RANGE}){0,${INCOME_SERIES_MAX_RANGES - 1}}$`),
    {
      message: `ranges must be 1-${INCOME_SERIES_MAX_RANGES} comma-separated fromDate:toDate pairs`,
    },
  )
  ranges!: string;
}
