/* ── Reinsurance domain types ── */

export const TREATY_TYPES = [
  'Quota Share',
  'Surplus',
  'Fac. Obligatory Treaty',
  'Excess of Loss',
] as const;

export const TREATY_STATUSES = ['Active', 'Pending', 'Expired', 'Cancelled'] as const;

export type TreatyType = (typeof TREATY_TYPES)[number];
export type TreatyStatus = (typeof TREATY_STATUSES)[number];

/* ── Table row shape ── */
export interface Treaty {
  id: string;
  name: string;
  type: TreatyType;
  cedant: string;
  share: number; // reinsurer's share 0-100
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  year: number;
  status: TreatyStatus;
}

/* ── Quota Share form ── */

export const TERRITORIAL_SCOPE_OPTIONS = [
  { value: 'Ghana', label: 'Ghana' },
  { value: 'Africa', label: 'Africa' },
  { value: 'Europe', label: 'Europe' },
  { value: 'Asia', label: 'Asia' },
  { value: 'Rest of the World', label: 'Rest of the World' },
];

export const ACCOUNTING_ARRANGEMENT_OPTIONS = [
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'Semi-Annual', label: 'Semi-Annual' },
  { value: 'Annual', label: 'Annual' },
];

export const CURRENCY_OPTIONS = [
  { value: 'GHC', label: 'GHC – Ghana Cedi' },
  { value: 'USD', label: 'USD – US Dollar' },
  { value: 'EUR', label: 'EUR – Euro' },
  { value: 'GBP', label: 'GBP – British Pound' },
  { value: 'NGN', label: 'NGN – Nigerian Naira' },
];

export interface QuotaShareFormValues {
  classOfBusiness: string;
  year: string;
  treatyName: string;
  territorialScope: string;
  accountingArrangement: string;
  currency: string;
  cedantCompany: string;
  broker: string;
  effectiveDate: string;
  expiryDate: string;
  cedantCommission: number | '';
  brokerageFee: number | '';
  limitOfLiability: number | '';
  cedantShare: number | '';
  reinsuranceShare: number | '';
  yourShare: number | '';
  supportingDocument: File | null;
}

/* ── Surplus form ── */
export interface SurplusFormValues {
  classOfBusiness: string;
  year: string;
  treatyName: string;
  territorialScope: string;
  accountingArrangement: string;
  currency: string;
  cedantCompany: string;
  broker: string;
  effectiveDate: string;
  expiryDate: string;
  cedantCommission: number | '';
  brokerageFee: number | '';
  /** The cedant's own retention per risk */
  cedantRetentionLine: number | '';
  /** Number of lines the reinsurer accepts above the retention */
  reinsuranceLine: number | '';
  /** totalCapacity = cedantRetentionLine × reinsuranceLine — computed, never submitted */
  yourShare: number | '';
  supportingDocument: File | null;
}

export const SURPLUS_DEFAULTS: SurplusFormValues = {
  classOfBusiness: '',
  year: String(new Date().getFullYear()),
  treatyName: '',
  territorialScope: '',
  accountingArrangement: '',
  currency: '',
  cedantCompany: '',
  broker: '',
  effectiveDate: '',
  expiryDate: '',
  cedantCommission: '',
  brokerageFee: '',
  cedantRetentionLine: '',
  reinsuranceLine: '',
  yourShare: '',
  supportingDocument: null,
};

/* ── Excess of Loss form ── */
export const EXCESS_OF_LOSS_TYPE_OPTIONS = [
  { value: 'Aggregate', label: 'Aggregate' },
  { value: 'Per Risk', label: 'Per Risk' },
  { value: 'Catastrophe', label: 'Catastrophe' },
];

export const BASIS_OF_ATTACHMENT_OPTIONS = [
  { value: 'Losses Occurring', label: 'Losses Occurring' },
  { value: 'Risk Attaching', label: 'Risk Attaching' },
];

export const REINSTATEMENT_TYPE_OPTIONS = [
  { value: 'Free', label: 'Free' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Pro-Rate', label: 'Pro-Rate' },
  { value: 'Full', label: 'Full' },
];

export interface TreatyLayer {
  name: string;
  retention: number | '';
  limit: number | '';
  reinstatements: number | '';
  reinstatementsType: string;
}

export const DEFAULT_TREATY_LAYER: TreatyLayer = {
  name: '',
  retention: '',
  limit: '',
  reinstatements: '',
  reinstatementsType: '',
};

export interface ExcessOfLossFormValues {
  classOfBusiness: string;
  excessOfLossType: string;
  year: string;
  treatyName: string;
  territorialScope: string;
  accountingArrangement: string;
  currency: string;
  cedantCompany: string;
  broker: string;
  effectiveDate: string;
  expiryDate: string;
  brokerageFee: number | '';
  basisOfAttachment: string;
  egnpi: number | '';
  rate: number | '';
  mAndD: number | '';
  layers: TreatyLayer[];
  reinsurerShare: number | '';
  yourShare: number | '';
  supportingDocument: File | null;
}

export const EXCESS_OF_LOSS_DEFAULTS: ExcessOfLossFormValues = {
  classOfBusiness: '',
  excessOfLossType: '',
  year: String(new Date().getFullYear()),
  treatyName: '',
  territorialScope: '',
  accountingArrangement: '',
  currency: '',
  cedantCompany: '',
  broker: '',
  effectiveDate: '',
  expiryDate: '',
  brokerageFee: '',
  basisOfAttachment: '',
  egnpi: '',
  rate: '',
  mAndD: '',
  layers: [{ ...DEFAULT_TREATY_LAYER }],
  reinsurerShare: '',
  yourShare: '',
  supportingDocument: null,
};

/* ── Fac. Obligatory Treaty form ── */
export interface FacObligatoryFormValues {
  classOfBusiness: string;
  year: string;
  treatyName: string;
  territorialScope: string;
  accountingArrangement: string;
  currency: string;
  cedantCompany: string;
  broker: string;
  effectiveDate: string;
  expiryDate: string;
  cedantCommission: number | '';
  brokerageFee: number | '';
  reinsurererShare: number | '';
  yourShare: number | '';
  supportingDocument: File | null;
}

export const FAC_OBLIGATORY_DEFAULTS: FacObligatoryFormValues = {
  classOfBusiness: '',
  year: String(new Date().getFullYear()),
  treatyName: '',
  territorialScope: '',
  accountingArrangement: '',
  currency: '',
  cedantCompany: '',
  broker: '',
  effectiveDate: '',
  expiryDate: '',
  cedantCommission: '',
  brokerageFee: '',
  reinsurererShare: '',
  yourShare: '',
  supportingDocument: null,
};

export const QUOTA_SHARE_DEFAULTS: QuotaShareFormValues = {
  classOfBusiness: '',
  year: String(new Date().getFullYear()),
  treatyName: '',
  territorialScope: '',
  accountingArrangement: '',
  currency: '',
  cedantCompany: '',
  broker: '',
  effectiveDate: '',
  expiryDate: '',
  cedantCommission: '',
  brokerageFee: '',
  limitOfLiability: '',
  cedantShare: '',
  reinsuranceShare: '',
  yourShare: '',
  supportingDocument: null,
};
