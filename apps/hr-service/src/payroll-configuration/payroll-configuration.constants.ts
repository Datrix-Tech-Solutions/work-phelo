/**
 * What a pay component can be. These mirror the payroll engine in the web app
 * (`apps/web/work-phelo-web/src/lib/payroll-engine/constants.ts`); keep the two in step until the
 * engine moves into a package both can share.
 */

export const COMPONENT_KINDS = [
  'earning',
  'deduction',
  'credit',
  'employer',
] as const;
export type ComponentKind = (typeof COMPONENT_KINDS)[number];

export const CALC_METHODS = [
  'fixed',
  'percent',
  'bands',
  'formula',
  'variable',
] as const;
export type CalcMethod = (typeof CALC_METHODS)[number];

export const PAY_BASES = [
  'basic',
  'commission',
  'gross',
  'pensionable',
  'taxable_income',
  'component',
] as const;
export type PayBase = (typeof PAY_BASES)[number];

export const ROUNDING_MODES = ['cent', 'whole', 'down', 'none'] as const;
export type RoundingMode = (typeof ROUNDING_MODES)[number];

export const BAND_PERIODS = ['monthly', 'annual'] as const;
export type BandPeriod = (typeof BAND_PERIODS)[number];

export const PAY_ROLES = [
  'salary_wages',
  'employee_social_security',
  'income_tax',
  'employer_social_security',
  'pension',
  'other_deductions',
  'tax_credit',
] as const;
export type PayRole = (typeof PAY_ROLES)[number];

export const VARIABLE_SOURCES = ['run', 'allowance', 'loans'] as const;
export type VariableSource = (typeof VARIABLE_SOURCES)[number];

export const ALLOWANCE_TYPES = [
  'TRANSPORT',
  'HOUSING',
  'MEDICAL',
  'CLOTHING',
  'OTHER',
] as const;

export const PAYSLIP_TYPE_KEYS = [
  'monthly',
  'commission',
  'monthly_commission',
] as const;
export type PayslipTypeKey = (typeof PAYSLIP_TYPE_KEYS)[number];

export const METHODS_BY_KIND: Record<ComponentKind, readonly CalcMethod[]> = {
  earning: ['fixed', 'percent', 'formula', 'variable'],
  deduction: ['fixed', 'percent', 'bands', 'formula', 'variable'],
  credit: ['fixed', 'percent', 'bands', 'formula', 'variable'],
  employer: ['fixed', 'percent', 'bands', 'formula', 'variable'],
};

export const ROLES_BY_KIND: Record<ComponentKind, readonly PayRole[]> = {
  earning: ['salary_wages'],
  deduction: [
    'employee_social_security',
    'income_tax',
    'pension',
    'other_deductions',
  ],
  credit: ['tax_credit'],
  employer: ['employer_social_security'],
};

export const VARIABLE_SOURCES_BY_KIND: Record<
  ComponentKind,
  readonly VariableSource[]
> = {
  earning: ['run', 'allowance'],
  deduction: ['run', 'loans'],
  credit: ['run'],
  employer: ['run'],
};

export const MAX_COMPONENTS = 200;
export const MAX_BANDS = 50;

/** The shape stored for a component. Only these fields are kept. */
export interface PayComponentData {
  id: string;
  code: string;
  name: string;
  kind: ComponentKind;
  method: CalcMethod;
  enabled: boolean;
  role?: PayRole;
  base: PayBase;
  rounding: RoundingMode;
  reduces?: string;
  baseComponentId?: string;
  sourceTemplateId?: string;
  params: {
    amount?: number | null;
    rate?: number | null;
    baseCap?: number | null;
    min?: number | null;
    max?: number | null;
    period?: BandPeriod;
    bands?: { upTo: number | null; rate: number | null }[];
    expr?: string;
    source?: VariableSource;
    allowanceType?: string;
  };
  tags: {
    taxable: boolean;
    pensionable: boolean;
    reducesTaxable: boolean;
    deductedFromPay?: boolean;
  };
}
