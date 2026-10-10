import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, Matches } from 'class-validator';

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
  /** Expected revenue per prospect in the stage; 0.00 when it has none. */
  average: string;
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

const DAY = '\\d{4}-\\d{2}-\\d{2}';
const RANGE = `${DAY}:${DAY}`;

export const GROWTH_MAX_RANGES = 12;

export class QueryDashboardGrowthDto {
  @ApiProperty({
    example: '2026-04-01:2026-04-30,2026-05-01:2026-05-31',
    description: `Comma-separated fromDate:toDate ranges (YYYY-MM-DD, both inclusive), at most ${GROWTH_MAX_RANGES}.`,
  })
  @IsString()
  @Matches(new RegExp(`^${RANGE}(,${RANGE}){0,${GROWTH_MAX_RANGES - 1}}$`), {
    message: `ranges must be 1-${GROWTH_MAX_RANGES} comma-separated fromDate:toDate pairs`,
  })
  ranges!: string;
}

export interface DashboardGrowthPoint {
  fromDate: string;
  toDate: string;
  newProspects: number;
  newClients: number;
}

export class QueryDashboardRevenueDto {
  @ApiProperty({ example: '2026-10-01', description: 'First day, inclusive.' })
  @IsDateString({ strict: true })
  fromDate!: string;

  @ApiProperty({ example: '2026-10-09', description: 'Last day, inclusive.' })
  @IsDateString({ strict: true })
  toDate!: string;
}

export interface DashboardRevenueProduct {
  /** Null for money received on transactions raised without a product. */
  productId: string | null;
  name: string;
  amount: string;
}

/** Money Accounting received in the period, split by the product it was raised for. */
export interface DashboardRevenueByProduct {
  currency: string | null;
  total: string;
  products: DashboardRevenueProduct[];
}
