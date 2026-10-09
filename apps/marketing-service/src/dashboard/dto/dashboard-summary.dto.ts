import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class QueryDashboardSummaryDto {
  @ApiProperty({ example: '2026-10-01', description: 'First day, inclusive.' })
  @IsDateString({ strict: true })
  fromDate!: string;

  @ApiProperty({ example: '2026-10-09', description: 'Last day, inclusive.' })
  @IsDateString({ strict: true })
  toDate!: string;

  @ApiProperty({
    example: '2026-09-01',
    description: 'First day of the range the trends compare with.',
  })
  @IsDateString({ strict: true })
  prevFromDate!: string;

  @ApiProperty({ example: '2026-09-09', description: 'Last day, inclusive.' })
  @IsDateString({ strict: true })
  prevToDate!: string;
}

export interface DashboardStage {
  stageId: string;
  name: string;
  probability: number;
  prospects: number;
  expected: string;
  weighted: string;
}

/** Money is a 2dp string. `null` means the figure could not be read (Accounting unreachable). */
export interface DashboardSummary {
  /** Currency Accounting reports its money in, when any client has an Accounting entity. */
  currency: string | null;
  newProspects: { current: number; previous: number };
  conversion: {
    created: number;
    converted: number;
    previousCreated: number;
    previousConverted: number;
  };
  sales: {
    won: string;
    previousWon: string;
    wonDeals: number;
    expected: string;
  };
  achievedRevenue: { current: string | null; previous: string | null };
  pipeline: {
    stages: DashboardStage[];
    prospects: number;
    expected: string;
    weighted: string;
  };
  targets: {
    count: number;
    target: string;
    achieved: string | null;
    remaining: string | null;
    percent: number | null;
  };
  clients: {
    total: number;
    new: number;
    billable: number;
    nonBillable: number;
  };
}
