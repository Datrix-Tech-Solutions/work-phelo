import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useFacultatives, fetchPlacementClosings, placementClosingsKey } from './useFacultatives';
import { useRiskTypes } from './useRiskTypes';
import { useRiskClasses } from './useRiskClasses';
import { fetchPlacementPayments, paymentsKey } from './usePayments';
import { useReportCurrencyTotals, ReportCurrencyTotals } from './useReportCurrencyTotals';
import {
  Facultative,
  FacultativeStatus,
  PlacementPayment,
  PlacementParticipantClosing,
} from '@/types/reinsurance';

const ACCEPTED_STATUSES = new Set(['PARTIALLY_PLACED', 'PLACED', 'CLOSING', 'CLOSED']);
const OPEN_STATUSES = new Set(['DRAFT', 'MARKETING']);
const QUALIFYING_PARTICIPANT_STATUSES = new Set(['ACCEPTED', 'CLOSED']);
const REINSURER_ROLES = new Set(['REINSURER', 'LEAD_REINSURER', 'CO_REINSURER']);
/** Payment states that still count as "received" for the premium-paid date — everything except a failed/cancelled/reversed attempt. */
const RECEIVED_PAYMENT_STATUSES = new Set(['RECORDED', 'BANK_CONFIRMED']);

export type FacultativeReportDateField = 'createdAt' | 'premiumPaid' | 'closingDate';

/** Latest matching premium receipt date for a placement — includes pending (RECORDED) payments, excludes failed/cancelled/reversed ones and reversal entries. */
function latestPremiumPaidDate(payments: PlacementPayment[]): string | null {
  let latest: string | null = null;
  for (const pmt of payments) {
    if (pmt.type !== 'PREMIUM_RECEIVED') continue;
    if (!RECEIVED_PAYMENT_STATUSES.has(pmt.status)) continue;
    if (pmt.reversalOfPaymentId) continue;
    if (!latest || new Date(pmt.paymentDate) > new Date(latest)) latest = pmt.paymentDate;
  }
  return latest;
}

/** Date the offer as a whole was closed: the force-close timestamp if it was force-closed,
 *  otherwise the latest participant closing's issuedAt — the moment the last participant closed. */
function closingDateFor(
  placement: Facultative,
  closings: PlacementParticipantClosing[],
): string | null {
  if (placement.forceClosedAt) return placement.forceClosedAt;
  let latest: string | null = null;
  for (const c of closings) {
    if (!c.issuedAt) continue;
    if (!latest || new Date(c.issuedAt) > new Date(latest)) latest = c.issuedAt;
  }
  return latest;
}

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

export type FacultativeReportLifecycle = 'ACTIVE' | 'EXPIRED';

export interface FacultativeReportParams {
  /** Which placement date [startDate, endDate] filters against. Defaults to 'createdAt' (date of entry). */
  dateField?: FacultativeReportDateField;
  startDate?: string;
  endDate?: string;
  riskClassIds?: string[];
  /** Exact match on the placement's own currency — rows aren't aggregated across currencies here. */
  currency?: string;
  statuses?: FacultativeStatus[];
  cedantIds?: string[];
  /** ACTIVE = today falls within [inceptionDate, expiryDate]; EXPIRED = expiryDate is in the past.
   *  Placements missing either date, or not yet started, match neither. */
  lifecycle?: FacultativeReportLifecycle;
}

export interface FacultativeReportRow {
  id: string;
  reference: string;
  policyNumber: string | null;
  cedantName: string;
  classOfBusiness: string | null;
  riskClassName: string | null;
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
  const { data: riskTypes = [] } = useRiskTypes();
  const { data: riskClasses = [] } = useRiskClasses();

  const riskTypeMap = useMemo(() => new Map(riskTypes.map((rt) => [rt.id, rt])), [riskTypes]);
  const riskClassMap = useMemo(
    () => new Map(riskClasses.map((rc) => [rc.id, rc.name])),
    [riskClasses],
  );

  const riskClassNameFor = useMemo(() => {
    return (riskTypeId: string | null): string | null =>
      riskTypeId
        ? (riskClassMap.get(riskTypeMap.get(riskTypeId)?.riskClassId ?? '') ?? null)
        : null;
  }, [riskTypeMap, riskClassMap]);

  const dateField = params.dateField ?? 'createdAt';
  // Only fetched when the selected date field actually needs them — 'createdAt' is already on
  // every placement, so these stay idle (and cost nothing) unless premium-paid/closing-date is picked.
  const needsPremiumPaid = enabled && dateField === 'premiumPaid';
  const needsClosingDate = enabled && dateField === 'closingDate';

  const premiumPaymentQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: paymentsKey(p.id),
      queryFn: () => fetchPlacementPayments(p.id),
      enabled: needsPremiumPaid,
    })),
  });
  const closingQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: placementClosingsKey(p.id),
      queryFn: () => fetchPlacementClosings(p.id),
      enabled: needsClosingDate,
    })),
  });
  const premiumPaymentsLoading = needsPremiumPaid && premiumPaymentQueries.some((q) => q.isLoading);
  const closingsLoading = needsClosingDate && closingQueries.some((q) => q.isLoading);

  const resolvedDateFor = useMemo(() => {
    const premiumPaidById = new Map(
      placements.map((p, i) => [p.id, latestPremiumPaidDate(premiumPaymentQueries[i]?.data ?? [])]),
    );
    const closingDateById = new Map(
      placements.map((p, i) => [p.id, closingDateFor(p, closingQueries[i]?.data ?? [])]),
    );
    return (p: Facultative): string | null => {
      switch (dateField) {
        case 'premiumPaid':
          return premiumPaidById.get(p.id) ?? null;
        case 'closingDate':
          return closingDateById.get(p.id) ?? null;
        case 'createdAt':
        default:
          return p.createdAt;
      }
    };
  }, [placements, premiumPaymentQueries, closingQueries, dateField]);

  const filtered = useMemo(() => {
    if (!enabled) return [];

    const from = params.startDate ? new Date(params.startDate) : null;
    const to = params.endDate ? new Date(params.endDate) : null;
    if (to) to.setHours(23, 59, 59, 999);
    const cedantIds = params.cedantIds?.length ? new Set(params.cedantIds) : null;
    const riskClassIds = params.riskClassIds?.length ? new Set(params.riskClassIds) : null;
    const statuses = params.statuses?.length ? new Set(params.statuses) : null;
    const now = new Date();

    return placements.filter((p) => {
      if (from || to) {
        const dateStr = resolvedDateFor(p);
        if (!dateStr) return false;
        const date = new Date(dateStr);
        if (from && date < from) return false;
        if (to && date > to) return false;
      }
      if (params.lifecycle) {
        if (!p.inceptionDate || !p.expiryDate) return false;
        const isExpired = new Date(p.expiryDate) < now;
        if (params.lifecycle === 'EXPIRED' && !isExpired) return false;
        if (params.lifecycle === 'ACTIVE' && (isExpired || new Date(p.inceptionDate) > now))
          return false;
      }
      if (riskClassIds) {
        const riskClassId = p.riskTypeId ? riskTypeMap.get(p.riskTypeId)?.riskClassId : undefined;
        if (!riskClassId || !riskClassIds.has(riskClassId)) return false;
      }
      if (params.currency && p.currency !== params.currency) return false;
      if (statuses && !statuses.has(p.status)) return false;
      if (cedantIds && !cedantIds.has(p.cedant.id)) return false;
      return true;
    });
  }, [
    placements,
    enabled,
    riskTypeMap,
    resolvedDateFor,
    params.startDate,
    params.endDate,
    params.lifecycle,
    params.riskClassIds,
    params.currency,
    params.statuses,
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
        riskClassName: riskClassNameFor(p.riskTypeId),
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
  }, [filtered, riskClassNameFor]);

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

  return {
    rows,
    summary,
    currencyTotals,
    isLoading: isLoading || premiumPaymentsLoading || closingsLoading,
  };
}
