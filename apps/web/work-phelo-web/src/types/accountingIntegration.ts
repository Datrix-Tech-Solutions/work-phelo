export type AccountingSourceModule = 'REINSURANCE' | (string & {});

export interface AccountingBankConfirmationWorkItem {
  id: string;
  sourceModule: AccountingSourceModule;
  sourceRecordId: string;
  sourceParentId: string;
  sourceReference: string;
  sourceDescription: string;
  counterpartyName: string;
  counterpartyType: string;
  amount: string | number;
  currency: string;
  businessDate: string;
  operationalReference: string | null;
  settlementReference: string | null;
  status: string;
}

export interface ConfirmBankPaymentPayload {
  bankConfirmedAt: string;
  bankReference: string;
  agreedExchangeRate?: number;
  bankChargeAmount?: number;
  withholdingTaxAmount?: number;
  notes?: string;
}
