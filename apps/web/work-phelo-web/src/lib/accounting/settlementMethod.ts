import type { SearchSelectOption } from '@/components/atoms/SearchSelect';

/** Shared across every "record a receipt/payment" form (AddTradeSettlementPanel,
 *  MakePaymentPanel) so the method list stays in one place. */
export const SETTLEMENT_METHOD_OPTIONS: SearchSelectOption[] = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CASH', label: 'Cash' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'INTERNAL_TRANSFER', label: 'Internal Transfer' },
  { value: 'JOURNAL', label: 'Journal' },
  { value: 'OTHER', label: 'Other' },
];
