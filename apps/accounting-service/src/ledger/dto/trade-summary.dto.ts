import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

/**
 * Optional window for the Accounts Receivable / Payable summaries. Both dates are needed for the
 * "raised in the period" figure; without them it is left empty. Everything else in the summary
 * is as of today and ignores the window.
 */
export class QueryTradeSummaryDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description: 'First day of the window, inclusive.',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description: 'Last day of the window, inclusive.',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
