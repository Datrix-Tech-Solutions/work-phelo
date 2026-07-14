import type { PlacementParticipantClosing, PlacementPayment } from '@/types/reinsurance';

export interface PlacementPaymentFinancialSummary {
  placementId: string;
  currency: string | null;
  payable: number;
  paid: number;
  outstanding: number;
  confirmedClosingCount: number;
  warnings: string[];
}

export function parseDecimalAmount(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function confirmedPlacementClosings(
  closings: PlacementParticipantClosing[],
): PlacementParticipantClosing[] {
  return closings.filter((closing) => closing.status === 'CONFIRMED');
}

export function placementPayableFromConfirmedClosings(closings: PlacementParticipantClosing[]): {
  amount: number;
  currency: string | null;
  warnings: string[];
  confirmedClosingCount: number;
} {
  const confirmed = confirmedPlacementClosings(closings);
  const currencies = new Set(confirmed.map((closing) => closing.currency).filter(Boolean));
  const warnings: string[] = [];
  if (currencies.size > 1) {
    warnings.push('Confirmed closings use multiple currencies; totals are not combined.');
  }

  const currency = currencies.size === 1 ? Array.from(currencies)[0] : null;
  const amount =
    currencies.size > 1
      ? 0
      : confirmed.reduce((sum, closing) => sum + parseDecimalAmount(closing.netPremium), 0);

  return {
    amount,
    currency,
    warnings,
    confirmedClosingCount: confirmed.length,
  };
}

export function recordedPremiumPaid(
  payments: PlacementPayment[],
  currency?: string | null,
): number {
  return payments
    .filter(
      (payment) =>
        payment.type === 'PREMIUM_RECEIVED' &&
        payment.status === 'RECORDED' &&
        !payment.reversalOfPaymentId &&
        (!currency || payment.currency === currency),
    )
    .reduce((sum, payment) => sum + parseDecimalAmount(payment.amount), 0);
}

export function summarizePlacementPaymentFinancials({
  placementId,
  closings,
  payments,
}: {
  placementId: string;
  closings: PlacementParticipantClosing[];
  payments: PlacementPayment[];
}): PlacementPaymentFinancialSummary {
  const payable = placementPayableFromConfirmedClosings(closings);
  const paid = recordedPremiumPaid(payments, payable.currency);
  return {
    placementId,
    currency: payable.currency,
    payable: payable.amount,
    paid,
    outstanding: Math.max(0, payable.amount - paid),
    confirmedClosingCount: payable.confirmedClosingCount,
    warnings: payable.warnings,
  };
}
