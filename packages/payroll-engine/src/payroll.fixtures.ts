import { DEFAULT_ROLE } from './constants';
import type { PayComponent } from './types';

/** Builders for the specs. Not part of the package: excluded from the build. */

type Spec = Pick<PayComponent, 'code' | 'name' | 'kind' | 'method'> &
  Partial<Omit<PayComponent, 'id' | 'code' | 'name' | 'kind' | 'method' | 'tags'>> & {
    tags?: Partial<PayComponent['tags']>;
    id?: string;
  };

export function component(spec: Spec): PayComponent {
  return {
    id: spec.code.toLowerCase(),
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

export const GHANA_BANDS = [
  { upTo: 490, rate: 0 },
  { upTo: 600, rate: 5 },
  { upTo: 730, rate: 10 },
  { upTo: 3896.67, rate: 17.5 },
  { upTo: 19896.67, rate: 25 },
  { upTo: 50416.67, rate: 30 },
  { upTo: null, rate: 35 },
];

export const ssnitTier1 = () =>
  component({
    code: 'SSNIT_T1',
    name: 'SSNIT Tier 1',
    kind: 'deduction',
    method: 'percent',
    role: 'employee_social_security',
    params: { rate: 0.5, baseCap: 69000 },
    tags: { reducesTaxable: true },
  });

export const ssnitTier2 = () =>
  component({
    code: 'SSNIT_T2',
    name: 'SSNIT Tier 2',
    kind: 'deduction',
    method: 'percent',
    // Tier 2 is remitted to SSNIT with Tier 1, so it is paid to the same recipient.
    role: 'employee_social_security',
    params: { rate: 5, baseCap: 69000 },
    tags: { reducesTaxable: true },
  });

/** The voluntary tier 3 pension, paid straight to a private fund. */
export const tier3Pension = () =>
  component({
    code: 'TIER3',
    name: 'Tier 3 pension',
    kind: 'deduction',
    method: 'percent',
    role: 'pension',
    params: { rate: 5 },
    tags: { reducesTaxable: true },
  });

export const paye = () =>
  component({
    code: 'PAYE',
    name: 'PAYE',
    kind: 'deduction',
    method: 'bands',
    role: 'income_tax',
    base: 'taxable_income',
    params: { period: 'monthly', bands: GHANA_BANDS },
  });

export const ssnitEmployer = () =>
  component({
    code: 'SSNIT_ER',
    name: 'SSNIT (employer)',
    kind: 'employer',
    method: 'percent',
    role: 'employer_social_security',
    params: { rate: 13, baseCap: 69000 },
  });

export const transport = (taxable: boolean) =>
  component({
    code: 'TRANSPORT',
    name: 'Transport allowance',
    kind: 'earning',
    method: 'variable',
    params: { source: 'allowance', allowanceType: 'TRANSPORT' },
    tags: { taxable },
  });

/** The Ghana monthly set-up from the walkthrough. */
export const ghanaMonthly = (transportTaxable = false) => [
  transport(transportTaxable),
  ssnitTier1(),
  ssnitTier2(),
  paye(),
  ssnitEmployer(),
];
