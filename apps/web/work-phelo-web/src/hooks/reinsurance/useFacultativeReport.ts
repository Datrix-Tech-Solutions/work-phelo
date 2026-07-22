import { useMemo } from 'react';
import { useFacultatives } from './useFacultatives';
import { useReportCurrencyTotals, ReportCurrencyTotals } from './useReportCurrencyTotals';
import { FacultativeStatus } from '@/types/reinsurance';

const ACCEPTED_STATUSES = new Set(['PARTIALLY_PLACED', 'PLACED', 'CLOSING', 'CLOSED']);
const OPEN_STATUSES = new Set(['DRAFT', 'MARKETING']);
const QUALIFYING_PARTICIPANT_STATUSES = new Set(['ACCEPTED', 'CLOSED']);

export interface FacultativeReportParams {
  /** Restricts to these years (by placement createdAt). Omitted/empty = all-time, no restriction. */
  years?: string[];
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
  totalOfferedPercent: number;
  totalAcceptedPercent: number;
  status: FacultativeStatus;
  inceptionDate: string | null;
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

    const years = params.years?.length ? new Set(params.years) : null;
    const cedantIds = params.cedantIds?.length ? new Set(params.cedantIds) : null;

    return placements.filter((p) => {
      if (years && !years.has(String(new Date(p.createdAt).getFullYear()))) return false;
      if (params.riskTypeId && p.riskTypeId !== params.riskTypeId) return false;
      if (params.currency && p.currency !== params.currency) return false;
      if (params.status && p.status !== params.status) return false;
      if (cedantIds && !cedantIds.has(p.cedant.id)) return false;
      return true;
    });
  }, [
    placements,
    enabled,
    params.years,
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
        totalOfferedPercent: p.totalOfferedPercent,
        totalAcceptedPercent: p.totalAcceptedPercent,
        status: p.status,
        inceptionDate: p.inceptionDate,
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
