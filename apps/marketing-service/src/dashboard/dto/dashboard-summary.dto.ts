import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

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

  @ApiPropertyOptional({
    description:
      'Only this sales rep’s prospects and clients. Omit for everyone the caller may see.',
  })
  @IsOptional()
  @IsString()
  userId?: string;
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

  @ApiPropertyOptional({
    description:
      'Only this sales rep’s prospects and clients. Omit for everyone the caller may see.',
  })
  @IsOptional()
  @IsString()
  userId?: string;
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

  @ApiPropertyOptional({
    description:
      'Only this sales rep’s prospects and clients. Omit for everyone the caller may see.',
  })
  @IsOptional()
  @IsString()
  userId?: string;
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

export class QueryDashboardSalesPersonnelDto {
  @ApiProperty({ example: '2026-10-01', description: 'First day, inclusive.' })
  @IsDateString({ strict: true })
  fromDate!: string;

  @ApiProperty({ example: '2026-10-09', description: 'Last day, inclusive.' })
  @IsDateString({ strict: true })
  toDate!: string;

  @ApiPropertyOptional({
    description:
      'Only this sales rep’s prospects and clients. Omit for everyone the caller may see.',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}

export interface DashboardSalesRep {
  userId: string;
  /** Falls back to "Unknown user" when the directory cannot name them. */
  name: string;
  /** Open prospects (not yet clients) the rep holds now. */
  prospects: number;
  /** Clients the rep holds now. */
  clients: number;
  /** Every prospect the rep has had, and how many of those have become clients. */
  created: number;
  converted: number;
  /** converted / created as a percentage (1dp); null when none were created. */
  conversion: number | null;
  /** Value of deals not yet won whose expected close date falls in the period. */
  expected: string;
  /** Money Accounting received from the rep's clients in the period; null if Accounting is down. */
  achieved: string | null;
}

export interface DashboardSalesPersonnel {
  currency: string | null;
  reps: DashboardSalesRep[];
}

export class QueryDashboardTargetsDto {
  @ApiProperty({ example: '2026-10-01', description: 'First day, inclusive.' })
  @IsDateString({ strict: true })
  fromDate!: string;

  @ApiProperty({ example: '2026-10-31', description: 'Last day, inclusive.' })
  @IsDateString({ strict: true })
  toDate!: string;

  @ApiPropertyOptional({
    description:
      'Only this sales rep’s targets. Omit for everyone the caller may see.',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}

export interface DashboardTargetRep {
  userId: string;
  name: string;
}

export interface DashboardTargetsOverview {
  count: number;
  target: string;
  achieved: string | null;
  remaining: string | null;
  percent: number | null;
  /** Reps with a target in the range that the caller may see, by name, for filtering. */
  reps: DashboardTargetRep[];
}

export class QueryDashboardBirthdaysDto {
  @ApiPropertyOptional({
    description:
      'Only this sales rep’s prospects and clients. Omit for everyone the caller may see.',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}

export interface DashboardBirthday {
  /** The contact's id, unique across prospects and clients. */
  id: string;
  contactName: string;
  companyName: string;
  type: 'CLIENT' | 'PROSPECT';
  /** The company's id, for linking to its page. */
  companyId: string;
  /** Next occurrence of the birthday, YYYY-MM-DD. */
  date: string;
}

export interface DashboardUpcomingBirthdays {
  withinDays: number;
  birthdays: DashboardBirthday[];
}

export interface DashboardRep {
  userId: string;
  name: string;
}
