import { useMemo } from 'react';
import { useFacultatives } from './useFacultatives';
import { useReportCurrencyTotals, ReportCurrencyTotals } from './useReportCurrencyTotals';
import { Facultative, FacultativeStatus } from '@/types/reinsurance';

const ACCEPTED_STATUSES = new Set(['PARTIALLY_PLACED', 'PLACED', 'CLOSING', 'CLOSED']);
const OPEN_STATUSES = new Set(['DRAFT', 'MARKETING']);
const QUALIFYING_PARTICIPANT_STATUSES = new Set(['ACCEPTED', 'CLOSED']);
const REINSURER_ROLES = new Set(['REINSURER', 'LEAD_REINSURER', 'CO_REINSURER']);

/** Sums sharePercent for participants that have accepted or closed — a closed reinsurer still counts as accepted. */
function acceptedPercentFor(p: Facultative): number {
  const sum = p.participants
    .filter((pt) => QUALIFYING_PARTICIPANT_STATUSES.has(pt.status))
    .reduce((total, pt) => total + (pt.sharePercent ? parseFloat(pt.sharePercent) : 0), 0);
  return Math.round(sum * 100) / 100;
}

/** Counts reinsurer-role participants that have accepted or closed — matches acceptedPercentFor's scope. */
function reinsurerCountFor(p: Facultative): number {
  return p.participants.filter(
    (pt) => REINSURER_ROLES.has(pt.role) && QUALIFYING_PARTICIPANT_STATUSES.has(pt.status),
  ).length;
}

export interface FacultativeReportParams {
  /** Restricts to placements whose inceptionDate (period of insurance start) falls in [startDate, endDate]. */
  startDate?: string;
  endDate?: string;
  riskTypeId?: string;
  /** Exact match on the placement's own currency — rows aren't aggregated across currencies here. */
  currency?: string;
  status?: FacultativeStatus;
  cedantIds?: string[];
}

export interface FacultativeReportRow {
  id: string;
  reference: string;
  policyNumber: string | null;
  cedantName: string;
  classOfBusiness: string | null;
  sumInsured: number | null;
  premium: number | null;
  currency: string | null;
  commission: number | null;
  totalOfferedPercent: number;
  totalAcceptedPercent: number;
  reinsurerCount: number;
  status: FacultativeStatus;
  inceptionDate: string | null;
  expiryDate: string | null;
}

export interface FacultativeReportSummary {
  totalOffers: number;
  openOffers: number;
  acceptanceRate: number;
}

export function useFacultativeReport(
  params: FacultativeReportParams,
  options: { enabled?: boolean } = {},
): {
  rows: FacultativeReportRow[];
  summary: FacultativeReportSummary;
  currencyTotals: ReportCurrencyTotals;
  isLoading: boolean;
} {
  const enabled = options.enabled ?? true;
  const { data: placements = [], isLoading } = useFacultatives();

  const filtered = useMemo(() => {
    if (!enabled) return [];

    const from = params.startDate ? new Date(params.startDate) : null;
    const to = params.endDate ? new Date(params.endDate) : null;
    if (to) to.setHours(23, 59, 59, 999);
    const cedantIds = params.cedantIds?.length ? new Set(params.cedantIds) : null;

    return placements.filter((p) => {
      if (from || to) {
        if (!p.inceptionDate) return false;
        const inception = new Date(p.inceptionDate);
        if (from && inception < from) return false;
        if (to && inception > to) return false;
      }
      if (params.riskTypeId && p.riskTypeId !== params.riskTypeId) return false;
      if (params.currency && p.currency !== params.currency) return false;
      if (params.status && p.status !== params.status) return false;
      if (cedantIds && !cedantIds.has(p.cedant.id)) return false;
      return true;
    });
  }, [
    placements,
    enabled,
    params.startDate,
    params.endDate,
    params.riskTypeId,
    params.currency,
    params.status,
    params.cedantIds,
  ]);

  const rows = useMemo<FacultativeReportRow[]>(() => {
    return [...filtered]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((p) => ({
        id: p.id,
        reference: p.reference,
        policyNumber: p.policyNumber,
        cedantName: p.cedant.name,
        classOfBusiness: p.classOfBusiness,
        sumInsured: p.sumInsured,
        premium: p.premium,
        currency: p.currency,
        commission: p.commission,
        totalOfferedPercent: p.totalOfferedPercent,
        totalAcceptedPercent: acceptedPercentFor(p),
        reinsurerCount: reinsurerCountFor(p),
        status: p.status,
        inceptionDate: p.inceptionDate,
        expiryDate: p.expiryDate,
      }));
  }, [filtered]);

  const summary = useMemo<FacultativeReportSummary>(() => {
    const total = filtered.length;
    const openOffers = filtered.filter((p) => OPEN_STATUSES.has(p.status)).length;
    const accepted = filtered.filter((p) => ACCEPTED_STATUSES.has(p.status)).length;
    return {
      totalOffers: total,
      openOffers,
      acceptanceRate: total > 0 ? (accepted / total) * 100 : 0,
    };
  }, [filtered]);

  const currencyTotalsEntries = useMemo(
    () =>
      filtered.map((p) => ({
        placement: p,
        participants: p.participants.filter((pt) => QUALIFYING_PARTICIPANT_STATUSES.has(pt.status)),
        scope: 'placement' as const,
      })),
    [filtered],
  );
  const currencyTotals = useReportCurrencyTotals(currencyTotalsEntries);

  return { rows, summary, currencyTotals, isLoading };
}
