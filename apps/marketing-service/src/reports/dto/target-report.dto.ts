import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryTargetReportDto {
  @ApiProperty({ example: 2026, description: 'Calendar year.' })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Only this sales rep. Without the view-all targets permission it can only be the caller.',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Only reps who work at this branch.' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Only reps in this department.' })
  @IsOptional()
  @IsString()
  departmentId?: string;
}

/** Money is a 2dp string. `null` means the figure could not be read (Accounting unreachable). */
export interface TargetReportRow {
  userId: string;
  name: string;
  branch: string | null;
  department: string | null;
  target: string;
  achieved: string | null;
  remaining: string | null;
  /** achieved / target as a percentage (1dp); null when there is no target or no figure. */
  percent: number | null;
  /** Value of deals not yet won whose expected close date falls in the year. */
  expected: string;
}

export interface TargetReport {
  year: number;
  currency: string | null;
  /** The caller may see every rep's figures and the team totals. */
  canViewTeam: boolean;
  reps: TargetReportRow[];
  /** Only for callers who may see the team. */
  totals: Omit<
    TargetReportRow,
    'userId' | 'name' | 'branch' | 'department'
  > | null;
}

export interface TargetReportFilters {
  reps: { userId: string; name: string }[];
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
}
