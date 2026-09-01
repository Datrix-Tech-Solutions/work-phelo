export interface PaymentReversalCandidate {
  id: string;
  type: string;
  status: string;
  reversalOfPaymentId: string | null;
}

export function canReversePayment(payment: PaymentReversalCandidate): boolean {
  if (payment.reversalOfPaymentId) return false;
  if (payment.type === 'REINSURER_DISBURSEMENT') {
    return payment.status === 'BANK_CONFIRMED';
  }
  if (payment.type === 'PREMIUM_RECEIVED') {
    return payment.status === 'BANK_CONFIRMED';
  }
  return payment.status === 'RECORDED';
}

export function paymentReversalRequest(placementId: string, payment: PaymentReversalCandidate) {
  return { placementId, paymentId: payment.id };
}
