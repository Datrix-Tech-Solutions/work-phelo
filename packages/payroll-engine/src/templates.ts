import { newComponentId } from './components';
import { DEFAULT_ROLE } from './constants';
import type { Band, PayComponent, PayslipTypeKey } from './types';

/**
 * Starting points for a configuration. A template is only a set of components to begin from: once
 * picked, the components are copied into the draft and are the user's to change and save. Nothing
 * ties a saved configuration back to the template it began as.
 */
export interface PayrollTemplate {
  id: string;
  name: string;
  /** ISO country code the rules belong to. */
  country: 'GH' | 'NG' | 'KE';
  payslipType: PayslipTypeKey;
  description: string;
  /** Things the template does not cover, so nobody assumes it does. */
  notes: string[];
  /** A fresh copy each time, with its own ids. */
  build: () => PayComponent[];
}

type Spec = Pick<PayComponent, 'code' | 'name' | 'kind' | 'method'> &
  Partial<Omit<PayComponent, 'id' | 'code' | 'name' | 'kind' | 'method' | 'tags'>> & {
    tags?: Partial<PayComponent['tags']>;
  };

function make(spec: Spec): PayComponent {
  return {
    id: newComponentId(),
    enabled: true,
    base: 'basic',
    rounding: 'cent',
    params: {},
    role: DEFAULT_ROLE[spec.kind],
    ...spec,
    tags: {
      taxable: false,
      pensionable: false,
      reducesTaxable: false,
      deductedFromPay: true,
      ...spec.tags,
    },
  };
}

const allowance = (name: string, code: string, allowanceType: string, taxable: boolean) =>
  make({
    code,
    name,
    kind: 'earning',
    method: 'variable',
    params: { source: 'allowance', allowanceType },
    tags: { taxable },
  });

const GHANA_BANDS: Band[] = [
  { upTo: 490, rate: 0 },
  { upTo: 600, rate: 5 },
  { upTo: 730, rate: 10 },
  { upTo: 3896.67, rate: 17.5 },
  { upTo: 19896.67, rate: 25 },
  { upTo: 50416.67, rate: 30 },
  { upTo: null, rate: 35 },
];

const KENYA_BANDS: Band[] = [
  { upTo: 24000, rate: 10 },
  { upTo: 32333, rate: 25 },
  { upTo: 500000, rate: 30 },
  { upTo: 800000, rate: 32.5 },
  { upTo: null, rate: 35 },
];

const NIGERIA_BANDS: Band[] = [
  { upTo: 300000, rate: 7 },
  { upTo: 600000, rate: 11 },
  { upTo: 1100000, rate: 15 },
  { upTo: 1600000, rate: 19 },
  { upTo: 3200000, rate: 21 },
  { upTo: null, rate: 24 },
];

function ghanaSalary(): PayComponent[] {
  return [
    allowance('Transport allowance', 'TRANSPORT', 'TRANSPORT', false),
    allowance('Housing allowance', 'HOUSING', 'HOUSING', true),
    make({
      code: 'SSNIT_T1',
      name: 'SSNIT Tier 1',
      kind: 'deduction',
      method: 'percent',
      role: 'employee_social_security',
      params: { rate: 0.5, baseCap: 69000 },
      tags: { reducesTaxable: true },
    }),
    make({
      code: 'SSNIT_T2',
      name: 'SSNIT Tier 2',
      kind: 'deduction',
      method: 'percent',
      role: 'employee_social_security',
      params: { rate: 5, baseCap: 69000 },
      tags: { reducesTaxable: true },
    }),
    make({
      code: 'TIER3',
      name: 'Tier 3 pension',
      kind: 'deduction',
      method: 'percent',
      role: 'pension',
      enabled: false,
      params: { rate: 5 },
      tags: { reducesTaxable: true },
    }),
    make({
      code: 'PAYE',
      name: 'PAYE',
      kind: 'deduction',
      method: 'bands',
      role: 'income_tax',
      base: 'taxable_income',
      params: { period: 'monthly', bands: GHANA_BANDS },
    }),
    make({
      code: 'SSNIT_ER',
      name: 'SSNIT (employer)',
      kind: 'employer',
      method: 'percent',
      params: { rate: 13, baseCap: 69000 },
    }),
  ];
}

function kenyaSalary(): PayComponent[] {
  const paye = make({
    code: 'PAYE',
    name: 'PAYE',
    kind: 'deduction',
    method: 'bands',
    role: 'income_tax',
    base: 'taxable_income',
    params: { period: 'monthly', bands: KENYA_BANDS },
  });
  return [
    allowance('Transport allowance', 'TRANSPORT', 'TRANSPORT', true),
    allowance('Housing allowance', 'HOUSING', 'HOUSING', true),
    make({
      code: 'NSSF',
      name: 'NSSF',
      kind: 'deduction',
      method: 'percent',
      role: 'employee_social_security',
      params: { rate: 6, baseCap: 108000 },
      tags: { reducesTaxable: true },
    }),
    paye,
    make({
      code: 'PERSONAL_RELIEF',
      name: 'Personal relief',
      kind: 'credit',
      method: 'fixed',
      base: 'component',
      reduces: paye.id,
      baseComponentId: paye.id,
      params: { amount: 2400 },
    }),
    make({
      code: 'NSSF_ER',
      name: 'NSSF (employer)',
      kind: 'employer',
      method: 'percent',
      params: { rate: 6, baseCap: 108000 },
    }),
  ];
}

function nigeriaSalary(): PayComponent[] {
  return [
    allowance('Transport allowance', 'TRANSPORT', 'TRANSPORT', true),
    allowance('Housing allowance', 'HOUSING', 'HOUSING', true),
    make({
      code: 'PENSION',
      name: 'Employee pension',
      kind: 'deduction',
      method: 'percent',
      role: 'pension',
      params: { rate: 8 },
      tags: { reducesTaxable: true },
    }),
    // Relief that lowers the tax base but is not taken from pay.
    make({
      code: 'CRA',
      name: 'Consolidated relief allowance',
      kind: 'deduction',
      method: 'formula',
      role: 'other_deductions',
      params: { expr: 'max(200000 / 12, 0.01 * GROSS) + 0.2 * GROSS' },
      tags: { reducesTaxable: true, deductedFromPay: false },
    }),
    make({
      code: 'PAYE',
      name: 'PAYE',
      kind: 'deduction',
      method: 'bands',
      role: 'income_tax',
      base: 'taxable_income',
      params: { period: 'annual', bands: NIGERIA_BANDS },
    }),
    make({
      code: 'PENSION_ER',
      name: 'Employer pension',
      kind: 'employer',
      method: 'percent',
      params: { rate: 10 },
    }),
  ];
}

export const PAYROLL_TEMPLATES: PayrollTemplate[] = [
  {
    id: 'ghana-salary',
    name: 'Ghana',
    country: 'GH',
    payslipType: 'monthly',
    description: 'SSNIT Tier 1 and Tier 2, PAYE on the monthly bands and employer SSNIT.',
    notes: [
      'Transport allowance is tax exempt. Housing allowance is taxable.',
      'Tier 3 pension is included but switched off.',
    ],
    build: ghanaSalary,
  },
  {
    id: 'nigeria-salary',
    name: 'Nigeria',
    country: 'NG',
    payslipType: 'monthly',
    description: 'Employee and employer pension, consolidated relief and PAYE on the annual bands.',
    notes: [
      'Follows the bands and relief of the old Nigeria calculator.',
      'The minimum tax of 1% of gross is not included.',
      'Employer pension is posted with employer social security.',
    ],
    build: nigeriaSalary,
  },
  {
    id: 'kenya-salary',
    name: 'Kenya',
    country: 'KE',
    payslipType: 'monthly',
    description: 'NSSF both sides, PAYE on the monthly bands and the personal relief.',
    notes: [
      'NSSF is 6% of pay up to 108,000.',
      'Occupational pension, the housing levy and SHIF are not included.',
    ],
    build: kenyaSalary,
  },
];
