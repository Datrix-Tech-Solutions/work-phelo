// GENERATED from packages/payroll-engine/src/types.ts by scripts/sync-payroll-engine.mjs.
// Do not edit this copy. Change the package, then run: npm run sync:payroll-engine

/**
 * Payroll engine domain types.
 *
 * Every payslip line is a pay component. The kind decides where it appears and
 * how it affects pay; the method decides how its amount is worked out; the role says what it
 * represents in accounting.
 */

export type ComponentKind = 'earning' | 'deduction' | 'credit' | 'employer';
export type CalcMethod = 'fixed' | 'percent' | 'bands' | 'formula' | 'variable';
/** Figures typed in for a payslip. Basic is pay; the commission figure (e.g. sales) is not pay by itself. */
export type PayInput = 'basic' | 'commission';
/** `component` is only for tax credits: calculated on one of the employee deductions. */
export type PayBase = PayInput | 'gross' | 'pensionable' | 'taxable_income' | 'component';
/** What a component represents in accounting. Net pay is derived, so it is never a role. */
export type PayRole =
  | 'salary_wages'
  | 'employee_social_security'
  | 'income_tax'
  | 'employer_social_security'
  | 'pension'
  | 'other_deductions'
  | 'tax_credit';
export type PayslipTypeKey = 'monthly' | 'commission' | 'monthly_commission';

export type PayInputs = Record<PayInput, number>;

/** Amounts typed in for variable components, by component id. */
export type VariableAmounts = Record<string, number>;
export type RoundingMode = 'cent' | 'whole' | 'down' | 'none';
/** Where a variable component's amount comes from when payroll is run. */
export type VariableSource = 'run' | 'allowance' | 'loans';
export type BandPeriod = 'monthly' | 'annual';

export interface Band {
  /** Upper limit of the band. `null` marks the open top band. */
  upTo: number | null;
  rate: number | null;
}

export interface ComponentParams {
  /** fixed, credit */
  amount?: number | null;
  /** percent */
  rate?: number | null;
  baseCap?: number | null;
  min?: number | null;
  max?: number | null;
  /** bands */
  period?: BandPeriod;
  bands?: Band[];
  /** formula */
  expr?: string;
  /** variable: where the amount starts from in the payroll run. Missing means typed each run. */
  source?: VariableSource;
  /** variable from employee allowances: which allowance type it takes */
  allowanceType?: string;
}

export interface ComponentTags {
  /** earning: counts as taxable pay */
  taxable: boolean;
  /** earning: counts as pensionable pay */
  pensionable: boolean;
  /** deduction: taken off before tax is worked out */
  reducesTaxable: boolean;
  /** deduction: taken from the employee's pay. Off means it only lowers taxable income. Missing means on. */
  deductedFromPay?: boolean;
}

export interface PayComponent {
  id: string;
  code: string;
  name: string;
  kind: ComponentKind;
  method: CalcMethod;
  enabled: boolean;
  base: PayBase;
  rounding: RoundingMode;
  /** What this component represents in accounting. Credits follow the deduction they reduce. */
  role?: PayRole;
  /** credit: id of the employee deduction this credit reduces */
  reduces?: string;
  /** credit: id of the employee deduction it is calculated on, when `base` is `component` */
  baseComponentId?: string;
  params: ComponentParams;
  tags: ComponentTags;
  /** The saved component this one was added from, so "Replace" knows what to update. */
  sourceTemplateId?: string;
}

/** A component kept for reuse. It is a copy: editing it later never changes components already added. */
export interface SavedPayComponent {
  id: string;
  savedAt: string;
  component: Omit<
    PayComponent,
    'id' | 'enabled' | 'sourceTemplateId' | 'reduces' | 'baseComponentId'
  >;
}

export interface TraceSlice {
  from: number;
  to: number;
  amount: number;
  rate: number;
  tax: number;
}

export type ComponentTrace =
  | { type: 'fixed'; amount: number }
  | { type: 'variable'; amount: number }
  | {
      type: 'percent';
      base: PayBase;
      /** Name of the component it was calculated on, when `base` is `component`. */
      baseName?: string;
      full: number;
      used: number;
      cap: number | null;
      rate: number;
      floor: number | null;
      ceil: number | null;
    }
  | {
      type: 'bands';
      base: PayBase;
      baseName?: string;
      factor: number;
      income: number;
      tax: number;
      slices: TraceSlice[];
    }
  | { type: 'formula'; expr: string; value: number };

export interface ComponentResult {
  component: PayComponent;
  amount: number;
  /** Total of the tax credits applied against this component (deductions only). */
  relief: number;
  /** The part of a tax credit actually applied against its deduction. */
  applied: number;
  targetName?: string;
  trace: ComponentTrace;
}

export interface PayslipResult {
  byId: Map<string, ComponentResult>;
  gross: number;
  taxable: number;
  pensionable: number;
  totalDeductions: number;
  /** Net pay never goes below zero. */
  net: number;
  /** How much the deductions are more than the pay, when net pay was held at zero. */
  shortfall: number;
  totalEmployer: number;
  employerCost: number;
}

/** One published state of a configuration. Payroll runs use the version in force on their date. */
export interface ConfigurationVersion {
  version: number;
  /** ISO date (YYYY-MM-DD) the version starts to apply. Earlier runs keep the earlier version. */
  effectiveFrom: string;
  note: string;
  savedAt: string;
  components: PayComponent[];
}

/** A configuration: its history of versions, and the one payslip type it is used for. */
export interface SavedConfiguration {
  id: string;
  name: string;
  /** `null` when another configuration has taken over its payslip type. */
  payslipType: PayslipTypeKey | null;
  /** Oldest first. */
  versions: ConfigurationVersion[];
}

export class PayrollEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayrollEngineError';
  }
}
