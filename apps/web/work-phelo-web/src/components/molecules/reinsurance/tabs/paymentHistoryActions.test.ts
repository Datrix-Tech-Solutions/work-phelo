import {
  canReversePayment,
  paymentReversalRequest,
  PaymentReversalCandidate,
} from './paymentHistoryActions';

function payment(overrides: Partial<PaymentReversalCandidate> = {}): PaymentReversalCandidate {
  return {
    id: 'payment-1',
    type: 'PREMIUM_RECEIVED',
    status: 'BANK_CONFIRMED',
    reversalOfPaymentId: null,
    ...overrides,
  };
}

describe('canReversePayment', () => {
  it('allows reversing bank-confirmed premium receipts', () => {
    expect(canReversePayment(payment())).toBe(true);
  });

  it('does not allow reversing recorded premium receipts', () => {
    expect(canReversePayment(payment({ status: 'RECORDED' }))).toBe(false);
  });

  it('does not allow reversing reversed premium receipts', () => {
    expect(canReversePayment(payment({ status: 'REVERSED' }))).toBe(false);
  });

  it('does not allow reversing linked reversal rows', () => {
    expect(canReversePayment(payment({ reversalOfPaymentId: 'original-payment-1' }))).toBe(false);
  });

  it('preserves existing bank-confirmed reinsurer disbursement visibility', () => {
    expect(
      canReversePayment(payment({ type: 'REINSURER_DISBURSEMENT', status: 'BANK_CONFIRMED' })),
    ).toBe(true);
  });

  it('builds the existing reversal hook payload with placement and payment IDs', () => {
    expect(paymentReversalRequest('placement-1', payment({ id: 'payment-1' }))).toEqual({
      placementId: 'placement-1',
      paymentId: 'payment-1',
    });
  });
});
