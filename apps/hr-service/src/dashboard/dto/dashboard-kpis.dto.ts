import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class QueryDashboardKpisDto {
  @ApiProperty({ example: '2026-10-01', description: 'First day, inclusive.' })
  @IsDateString({ strict: true })
  fromDate!: string;

  @ApiProperty({ example: '2026-10-11', description: 'Last day, inclusive.' })
  @IsDateString({ strict: true })
  toDate!: string;

  @ApiProperty({
    example: '2026-09-01',
    description: 'First day of the range the trends compare with.',
  })
  @IsDateString({ strict: true })
  prevFromDate!: string;

  @ApiProperty({ example: '2026-09-11', description: 'Last day, inclusive.' })
  @IsDateString({ strict: true })
  prevToDate!: string;
}

export interface DashboardKpis {
  headcount: {
    current: number;
    previous: number;
    /** Of the current headcount, by present employment status. */
    onProbation: number;
    suspended: number;
  };
  attendance: {
    /** Percentage 0–100, or null when no working days fall in the range yet. */
    rate: number | null;
    previousRate: number | null;
    late: number;
    absent: number;
  };
  onLeave: {
    /** Distinct employees on approved leave at any point in the range. */
    current: number;
    previous: number;
    today: number;
    pending: number;
  };
  hiresAndExits: {
    hires: number;
    previousHires: number;
    exits: number;
    previousExits: number;
    /** Exits as a percentage of average headcount, or null with no headcount. */
    turnoverRate: number | null;
    previousTurnoverRate: number | null;
  };
}
