import { FiscalPeriodStatus } from '../../prisma/generated/client';

/**
 * A fiscal year has no status of its own — it follows its periods:
 * OPEN while any period is open, otherwise SOFT_CLOSED while any is soft closed, LOCKED once
 * every period is locked, and CLOSED when all are closed or locked.
 */
export function deriveFiscalYearStatus(
  statuses: FiscalPeriodStatus[],
): FiscalPeriodStatus {
  if (statuses.length === 0) return FiscalPeriodStatus.OPEN;
  if (statuses.includes(FiscalPeriodStatus.OPEN))
    return FiscalPeriodStatus.OPEN;
  if (statuses.includes(FiscalPeriodStatus.SOFT_CLOSED)) {
    return FiscalPeriodStatus.SOFT_CLOSED;
  }
  return statuses.every((s) => s === FiscalPeriodStatus.LOCKED)
    ? FiscalPeriodStatus.LOCKED
    : FiscalPeriodStatus.CLOSED;
}

/** FY2026 for a January start; FY2026/27 when the year straddles two calendar years. */
export function fiscalYearName(startYear: number, startMonth: number): string {
  return startMonth === 1
    ? `FY${startYear}`
    : `FY${startYear}/${String(startYear + 1).slice(-2)}`;
}

/** The year record as the API returns it: window, derived status and period progress. */
export function summarizeFiscalYear(
  year: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    createdAt: Date;
  },
  periods: { status: FiscalPeriodStatus }[],
) {
  const statuses = periods.map((period) => period.status);
  return {
    id: year.id,
    name: year.name,
    startDate: year.startDate,
    endDate: year.endDate,
    status: deriveFiscalYearStatus(statuses),
    periodCount: periods.length,
    // Closed or locked — i.e. no longer accepting postings and past review.
    closedPeriodCount: statuses.filter(
      (s) => s === FiscalPeriodStatus.CLOSED || s === FiscalPeriodStatus.LOCKED,
    ).length,
    createdAt: year.createdAt,
  };
}
