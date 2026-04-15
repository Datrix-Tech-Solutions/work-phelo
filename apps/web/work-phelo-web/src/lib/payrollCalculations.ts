export type Country = 'GH' | 'NG' | 'KE';

export interface PayrollInput {
  country: Country;
  basicSalary: number;
  allowances: number;
  otherDeductions?: number;
  /** Nigeria only: monthly rent relief amount */
  rentRelief?: number;
}

export interface PayrollResult {
  basicSalary: number;
  allowances: number;
  grossSalary: number;
  employeePensionOrSSNIT: number;
  employeeSSNIT: number;
  employerPensionOrSSNIT: number;
  employerSSNIT: number;
  taxableIncome: number;
  paye: number;
  netSalary: number;
  totalEmployerCost: number;
  currency: string;
}

export class PayrollValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayrollValidationError';
  }
}

const PAYROLL_CONFIG = {
  GH: {
    currency: 'GHS' as const,
    employeeRate: 0.055,
    employerRate: 0.13,
    maxInsurableEarnings: 69_000,
  },
  NG: {
    currency: 'NGN' as const,
    employeeRate: 0.08,
    employerRate: 0.1,
  },
  KE: {
    currency: 'KES' as const,
    nssfLowerLimit: 9_000,
    nssfUpperLimit: 108_000,
    personalRelief: 2_400,
  },
} as const;

function validateInput(input: PayrollInput): void {
  const { country, basicSalary, allowances, otherDeductions = 0, rentRelief = 0 } = input;

  if (!Number.isFinite(basicSalary) || basicSalary < 0)
    throw new PayrollValidationError('basicSalary must be a non-negative number');
  if (!Number.isFinite(allowances) || allowances < 0)
    throw new PayrollValidationError('allowances must be a non-negative number');
  if (!Number.isFinite(otherDeductions) || otherDeductions < 0)
    throw new PayrollValidationError('otherDeductions must be a non-negative number');
  if (!Number.isFinite(rentRelief) || rentRelief < 0)
    throw new PayrollValidationError('rentRelief must be a non-negative number');
  if (rentRelief > 0 && country !== 'NG')
    throw new PayrollValidationError(
      `rentRelief is only applicable for Nigeria, received ${country}`,
    );
  if (otherDeductions > basicSalary + allowances)
    throw new PayrollValidationError('otherDeductions cannot exceed gross salary');
}

function calculatePAYE_GH(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  let r = taxableIncome;

  // 0% on first 490
  if (r > 490) r -= 490;
  else return 0;

  const b2 = Math.min(r, 110);
  tax += b2 * 0.05;
  r -= b2;
  const b3 = Math.min(r, 130);
  tax += b3 * 0.1;
  r -= b3;
  const b4 = Math.min(r, 3166.67);
  tax += b4 * 0.175;
  r -= b4;
  const b5 = Math.min(r, 16_000);
  tax += b5 * 0.25;
  r -= b5;
  const b6 = Math.min(r, 30_520);
  tax += b6 * 0.3;
  r -= b6;
  if (r > 0) tax += r * 0.35;

  return Math.round(tax);
}

function calculatePAYE_NG(annualTaxable: number, rentReliefAnnual = 0): number {
  if (annualTaxable <= 0) return 0;

  const bands = [
    { threshold: 800_000, rate: 0 },
    { threshold: 3_000_000, rate: 0.15 },
    { threshold: 12_000_000, rate: 0.18 },
    { threshold: 25_000_000, rate: 0.21 },
    { threshold: 50_000_000, rate: 0.23 },
    { threshold: Infinity, rate: 0.25 },
  ];

  let tax = 0,
    previous = 0;
  for (const band of bands) {
    const inBand = Math.min(annualTaxable, band.threshold) - previous;
    if (inBand > 0) tax += inBand * band.rate;
    previous = band.threshold;
    if (annualTaxable <= band.threshold) break;
  }

  return Math.round(Math.max(0, tax - rentReliefAnnual) / 12);
}

function calculateNSSF_KE(basicSalary: number): { employee: number; employer: number } {
  const { nssfLowerLimit, nssfUpperLimit } = PAYROLL_CONFIG.KE;
  const tier1 = Math.min(basicSalary, nssfLowerLimit);
  const tier2 = Math.max(0, Math.min(basicSalary, nssfUpperLimit) - nssfLowerLimit);
  const contrib = Math.round((tier1 + tier2) * 0.06);
  return { employee: contrib, employer: contrib };
}

function calculatePAYE_KE(taxableIncome: number, personalRelief: number): number {
  if (taxableIncome <= 0) return 0;

  let grossTax: number;
  if (taxableIncome <= 24_000) grossTax = taxableIncome * 0.1;
  else if (taxableIncome <= 32_333) grossTax = 2_400 + (taxableIncome - 24_000) * 0.25;
  else if (taxableIncome <= 500_000) grossTax = 2_400 + 2_083.25 + (taxableIncome - 32_333) * 0.3;
  else if (taxableIncome <= 800_000)
    grossTax = 2_400 + 2_083.25 + 140_300.1 + (taxableIncome - 500_000) * 0.325;
  else grossTax = 2_400 + 2_083.25 + 140_300.1 + 97_500 + (taxableIncome - 800_000) * 0.35;

  return Math.round(Math.max(0, grossTax - personalRelief));
}

export function calculatePayroll(input: PayrollInput): PayrollResult {
  validateInput(input);

  const { country, basicSalary, allowances, otherDeductions = 0, rentRelief = 0 } = input;
  const grossSalary = basicSalary + allowances;

  let employeeContrib = 0;
  let employerContrib = 0;
  let paye = 0;
  let taxableIncome = 0;

  switch (country) {
    case 'GH': {
      const { employeeRate, employerRate, maxInsurableEarnings } = PAYROLL_CONFIG.GH;
      const insurable = Math.min(basicSalary, maxInsurableEarnings);
      employeeContrib = Math.round(insurable * employeeRate);
      employerContrib = Math.round(insurable * employerRate);
      taxableIncome = Math.max(0, grossSalary - employeeContrib - otherDeductions);
      paye = calculatePAYE_GH(taxableIncome);
      break;
    }
    case 'NG': {
      const { employeeRate, employerRate } = PAYROLL_CONFIG.NG;
      employeeContrib = Math.round(basicSalary * employeeRate);
      employerContrib = Math.round(basicSalary * employerRate);
      taxableIncome = Math.max(0, grossSalary - employeeContrib - otherDeductions);
      paye = calculatePAYE_NG(taxableIncome * 12, rentRelief * 12);
      break;
    }
    case 'KE': {
      const nssf = calculateNSSF_KE(basicSalary);
      employeeContrib = nssf.employee;
      employerContrib = nssf.employer;
      taxableIncome = Math.max(0, grossSalary - employeeContrib - otherDeductions);
      paye = calculatePAYE_KE(taxableIncome, PAYROLL_CONFIG.KE.personalRelief);
      break;
    }
  }

  const netSalary = Math.round(taxableIncome - paye);
  const totalEmployerCost = Math.round(grossSalary + employerContrib);

  return {
    basicSalary: Math.round(basicSalary),
    allowances: Math.round(allowances),
    grossSalary: Math.round(grossSalary),
    employeePensionOrSSNIT: employeeContrib,
    employeeSSNIT: employeeContrib,
    employerPensionOrSSNIT: employerContrib,
    employerSSNIT: employerContrib,
    taxableIncome: Math.round(taxableIncome),
    paye,
    netSalary,
    totalEmployerCost,
    currency: PAYROLL_CONFIG[country].currency,
  };
}

export const COUNTRY_META: Record<
  Country,
  {
    label: string;
    flag: string;
    pensionLabel: string;
    employeeRate: string;
    employerRate: string;
    note?: string;
  }
> = {
  GH: {
    label: 'Ghana',
    flag: '🇬🇭',
    pensionLabel: 'SSNIT',
    employeeRate: '5.5%',
    employerRate: '13%',
    note: 'Max insurable earnings: GHS 69,000/month',
  },
  NG: {
    label: 'Nigeria',
    flag: '🇳🇬',
    pensionLabel: 'Pension',
    employeeRate: '8%',
    employerRate: '10%',
    note: 'PAYE computed annually then divided by 12',
  },
  KE: {
    label: 'Kenya',
    flag: '🇰🇪',
    pensionLabel: 'NSSF',
    employeeRate: '6% tiered',
    employerRate: '6% tiered',
    note: 'Personal relief: KES 2,400/month applied post-tax',
  },
};

// export type Country = 'GH' | 'NG' | 'KE';

// export interface AllowanceItem {
//   name: string;
//   amount: number;
// }

// export interface PayrollInput {
//   country: Country;
//   basicSalary: number;
//   allowances: AllowanceItem[];
//   otherDeductions?: number;
//   /** Nigeria only: monthly rent relief amount */
//   rentRelief?: number;
// }

// export interface PayrollResult {
//   basicSalary: number;
//   allowances: AllowanceItem[];
//   totalAllowances: number;
//   grossSalary: number;
//   employeePensionOrSSNIT: number;
//   employerPensionOrSSNIT: number;
//   taxableIncome: number;
//   paye: number;
//   netSalary: number;
//   totalEmployerCost: number;
//   currency: string;
// }

// export class PayrollValidationError extends Error {
//   constructor(message: string) {
//     super(message);
//     this.name = 'PayrollValidationError';
//   }
// }

// const PAYROLL_CONFIG = {
//   GH: {
//     currency: 'GHS' as const,
//     employeeRate: 0.055,
//     employerRate: 0.13,
//     maxInsurableEarnings: 69_000,
//   },
//   NG: {
//     currency: 'NGN' as const,
//     employeeRate: 0.08,
//     employerRate: 0.10,
//   },
//   KE: {
//     currency: 'KES' as const,
//     nssfLowerLimit: 9_000,
//     nssfUpperLimit: 108_000,
//     personalRelief: 2_400,
//   },
// } as const;

// function validateInput(input: PayrollInput): void {
//   const { country, basicSalary, allowances, otherDeductions = 0, rentRelief = 0 } = input;

//   if (!Number.isFinite(basicSalary) || basicSalary < 0)
//     throw new PayrollValidationError('basicSalary must be a non-negative number');

//   if (!Array.isArray(allowances))
//     throw new PayrollValidationError('allowances must be an array');

//   for (const item of allowances) {
//     if (!item.name || item.name.trim() === '')
//       throw new PayrollValidationError('Each allowance must have a name');
//     if (!Number.isFinite(item.amount) || item.amount < 0)
//       throw new PayrollValidationError(`Allowance "${item.name}" must have a non-negative amount`);
//   }

//   if (!Number.isFinite(otherDeductions) || otherDeductions < 0)
//     throw new PayrollValidationError('otherDeductions must be a non-negative number');
//   if (!Number.isFinite(rentRelief) || rentRelief < 0)
//     throw new PayrollValidationError('rentRelief must be a non-negative number');
//   if (rentRelief > 0 && country !== 'NG')
//     throw new PayrollValidationError(`rentRelief is only applicable for Nigeria, received ${country}`);

//   const totalAllowances = allowances.reduce((sum, a) => sum + a.amount, 0);
//   if (otherDeductions > basicSalary + totalAllowances)
//     throw new PayrollValidationError('otherDeductions cannot exceed gross salary');
// }

// function calculatePAYE_GH(taxableIncome: number): number {
//   if (taxableIncome <= 0) return 0;
//   let tax = 0;
//   let r = taxableIncome;

//   if (r > 490) r -= 490; else return 0;

//   const b2 = Math.min(r, 110);     tax += b2 * 0.05;   r -= b2;
//   const b3 = Math.min(r, 130);     tax += b3 * 0.10;   r -= b3;
//   const b4 = Math.min(r, 3166.67); tax += b4 * 0.175;  r -= b4;
//   const b5 = Math.min(r, 16_000);  tax += b5 * 0.25;   r -= b5;
//   const b6 = Math.min(r, 30_520);  tax += b6 * 0.30;   r -= b6;
//   if (r > 0) tax += r * 0.35;

//   return Math.round(tax);
// }

// function calculatePAYE_NG(annualTaxable: number, rentReliefAnnual = 0): number {
//   if (annualTaxable <= 0) return 0;

//   const bands = [
//     { threshold: 800_000,    rate: 0    },
//     { threshold: 3_000_000,  rate: 0.15 },
//     { threshold: 12_000_000, rate: 0.18 },
//     { threshold: 25_000_000, rate: 0.21 },
//     { threshold: 50_000_000, rate: 0.23 },
//     { threshold: Infinity,   rate: 0.25 },
//   ];

//   let tax = 0, previous = 0;
//   for (const band of bands) {
//     const inBand = Math.min(annualTaxable, band.threshold) - previous;
//     if (inBand > 0) tax += inBand * band.rate;
//     previous = band.threshold;
//     if (annualTaxable <= band.threshold) break;
//   }

//   return Math.round(Math.max(0, tax - rentReliefAnnual) / 12);
// }

// function calculateNSSF_KE(basicSalary: number): { employee: number; employer: number } {
//   const { nssfLowerLimit, nssfUpperLimit } = PAYROLL_CONFIG.KE;
//   const tier1 = Math.min(basicSalary, nssfLowerLimit);
//   const tier2 = Math.max(0, Math.min(basicSalary, nssfUpperLimit) - nssfLowerLimit);
//   const contrib = Math.round((tier1 + tier2) * 0.06);
//   return { employee: contrib, employer: contrib };
// }

// function calculatePAYE_KE(taxableIncome: number, personalRelief: number): number {
//   if (taxableIncome <= 0) return 0;

//   let grossTax: number;
//   if      (taxableIncome <= 24_000)  grossTax = taxableIncome * 0.10;
//   else if (taxableIncome <= 32_333)  grossTax = 2_400 + (taxableIncome - 24_000) * 0.25;
//   else if (taxableIncome <= 500_000) grossTax = 2_400 + 2_083.25 + (taxableIncome - 32_333) * 0.30;
//   else if (taxableIncome <= 800_000) grossTax = 2_400 + 2_083.25 + 140_300.10 + (taxableIncome - 500_000) * 0.325;
//   else                               grossTax = 2_400 + 2_083.25 + 140_300.10 + 97_500 + (taxableIncome - 800_000) * 0.35;

//   return Math.round(Math.max(0, grossTax - personalRelief));
// }

// export function calculatePayroll(input: PayrollInput): PayrollResult {
//   validateInput(input);

//   const { country, basicSalary, allowances, otherDeductions = 0, rentRelief = 0 } = input;
//   const totalAllowances = allowances.reduce((sum, a) => sum + a.amount, 0);
//   const grossSalary = basicSalary + totalAllowances;

//   let employeeContrib = 0;
//   let employerContrib = 0;
//   let paye = 0;
//   let taxableIncome = 0;

//   switch (country) {
//     case 'GH': {
//       const { employeeRate, employerRate, maxInsurableEarnings } = PAYROLL_CONFIG.GH;
//       const insurable = Math.min(basicSalary, maxInsurableEarnings);
//       employeeContrib = Math.round(insurable * employeeRate);
//       employerContrib = Math.round(insurable * employerRate);
//       taxableIncome   = Math.max(0, grossSalary - employeeContrib - otherDeductions);
//       paye            = calculatePAYE_GH(taxableIncome);
//       break;
//     }
//     case 'NG': {
//       const { employeeRate, employerRate } = PAYROLL_CONFIG.NG;
//       employeeContrib = Math.round(basicSalary * employeeRate);
//       employerContrib = Math.round(basicSalary * employerRate);
//       taxableIncome   = Math.max(0, grossSalary - employeeContrib - otherDeductions);
//       paye            = calculatePAYE_NG(taxableIncome * 12, rentRelief * 12);
//       break;
//     }
//     case 'KE': {
//       const nssf      = calculateNSSF_KE(basicSalary);
//       employeeContrib = nssf.employee;
//       employerContrib = nssf.employer;
//       taxableIncome   = Math.max(0, grossSalary - employeeContrib - otherDeductions);
//       paye            = calculatePAYE_KE(taxableIncome, PAYROLL_CONFIG.KE.personalRelief);
//       break;
//     }
//   }

//   const netSalary         = Math.round(taxableIncome - paye);
//   const totalEmployerCost = Math.round(grossSalary + employerContrib);

//   return {
//     basicSalary:            Math.round(basicSalary),
//     allowances,
//     totalAllowances:        Math.round(totalAllowances),
//     grossSalary:            Math.round(grossSalary),
//     employeePensionOrSSNIT: employeeContrib,
//     employerPensionOrSSNIT: employerContrib,
//     taxableIncome:          Math.round(taxableIncome),
//     paye,
//     netSalary,
//     totalEmployerCost,
//     currency:               PAYROLL_CONFIG[country].currency,
//   };
// }

// export const COUNTRY_META: Record<Country, {
//   label: string;
//   flag: string;
//   pensionLabel: string;
//   employeeRate: string;
//   employerRate: string;
//   note?: string;
// }> = {
//   GH: {
//     label: 'Ghana',
//     flag: '🇬🇭',
//     pensionLabel: 'SSNIT',
//     employeeRate: '5.5%',
//     employerRate: '13%',
//     note: 'Max insurable earnings: GHS 69,000/month',
//   },
//   NG: {
//     label: 'Nigeria',
//     flag: '🇳🇬',
//     pensionLabel: 'Pension',
//     employeeRate: '8%',
//     employerRate: '10%',
//     note: 'PAYE computed annually then divided by 12',
//   },
//   KE: {
//     label: 'Kenya',
//     flag: '🇰🇪',
//     pensionLabel: 'NSSF',
//     employeeRate: '6% tiered',
//     employerRate: '6% tiered',
//     note: 'Personal relief: KES 2,400/month applied post-tax',
//   },
// };
