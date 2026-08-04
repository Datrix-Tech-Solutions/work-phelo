export type AccountingSourceModule = 'REINSURANCE' | (string & {});
export type AccountingConfirmationDirection = 'INBOUND' | 'OUTBOUND';
export type AccountingConfirmationAction = 'CONFIRM_BANK_PAYMENT';

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
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ConfirmBankPaymentPayload {
  bankConfirmedAt: string;
  bankReference: string;
  agreedExchangeRate?: number;
  bankChargeAmount?: number;
  withholdingTaxAmount?: number;
  notes?: string;
}
