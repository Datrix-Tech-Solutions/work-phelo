export type AccountingSourceModule = 'REINSURANCE' | (string & {});
export type AccountingConfirmationDirection = 'INBOUND' | 'OUTBOUND';
export type AccountingConfirmationAction = 'CONFIRM_BANK_PAYMENT';
export type SettlementMethod =
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'CASH'
  | 'MOBILE_MONEY'
  | 'INTERNAL_OFFSET'
  | 'JOURNAL'
  | 'OTHER';

export interface AccountingConfirmationBusinessSnapshot {
  placementReference?: string | null;
  endorsementReference?: string | null;
  closingReference?: string | null;
  reinsurerName?: string | null;
  operationalPaymentAmount?: string | number | null;
  operationalPaymentCurrency?: string | null;
  obligationCurrency?: string | null;
  cedantPremiumPaymentCurrency?: string | null;
  cedantPaymentFxRate?: string | number | null;
  nicLevyAmount?: string | number | null;
  contractualWithholdingTaxAmount?: string | number | null;
  contractualWithholdingTaxRate?: string | number | null;
  creditNoteReference?: string | null;
  operationalPaymentDate?: string | null;
  paymentReference?: string | null;
}

export interface AccountingBankConfirmationWorkItem {
  id: string;
  sourceModule: AccountingSourceModule;
  sourceRecordId: string;
  sourceParentId: string;
  sourceReference: string;
  transactionType: string;
  direction: AccountingConfirmationDirection;
  counterpartyId: string;
  sourceDescription: string;
  sourceDetailUrl: string | null;
  counterpartyName: string;
  counterpartyType: string;
  amount: string | number;
  currency: string;
  operationalDate: string;
  operationalReference: string | null;
  settlementReference: string | null;
  operationalStatus: string;
  confirmationStatus: string;
  availableConfirmationActions: AccountingConfirmationAction[];
  businessSnapshot?: AccountingConfirmationBusinessSnapshot;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ConfirmBankPaymentPayload {
  bankConfirmedAt: string;
  bankReference?: string;
  settlementMethod?: SettlementMethod;
  settlementCurrency?: string;
  confirmedExchangeRate?: number;
  agreedExchangeRate?: number;
  bankChargeAmount?: number;
  notes?: string;
}
