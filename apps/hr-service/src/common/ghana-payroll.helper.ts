import Decimal from 'decimal.js';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export const EMPLOYEE_SSNIT_RATE = '0.055';
export const EMPLOYER_SSNIT_RATE = '0.13';

const PAYE_TIERS = [
  { limit: '4380', rate: '0' },
  { limit: '1320', rate: '0.05' },
  { limit: '1560', rate: '0.10' },
  { limit: '38000', rate: '0.175' },
  { limit: '15000', rate: '0.25' },
  { limit: '999999999', rate: '0.30' },
];

export function calculateSSNIT(basicSalary: string): {
  employeeSSNIT: string;
  employerSSNIT: string;
} {
  const basic = new Decimal(basicSalary);
  return {
    employeeSSNIT: basic
      .times(EMPLOYEE_SSNIT_RATE)
      .toDecimalPlaces(2)
      .toString(),
    employerSSNIT: basic
      .times(EMPLOYER_SSNIT_RATE)
      .toDecimalPlaces(2)
      .toString(),
  };
}

export function calculateMonthlyPAYE(monthlyGross: string): string {
  const annual = new Decimal(monthlyGross).times(12);
  let taxableIncome = annual;
  let totalTax = new Decimal(0);

  for (const tier of PAYE_TIERS) {
    if (taxableIncome.lte(0)) break;
    const tierLimitDec = new Decimal(tier.limit);
    const tierLimit = taxableIncome.lt(tierLimitDec)
      ? taxableIncome
      : tierLimitDec;
    totalTax = totalTax.plus(tierLimit.times(new Decimal(tier.rate)));
    taxableIncome = taxableIncome.minus(tierLimit);
  }

  return totalTax.div(12).toDecimalPlaces(2).toString();
}

export function calculateGrossSalary(
  basicSalary: string,
  totalAllowances: string,
  overtimePay: string,
  bonus: string,
  thirteenthMonth: string,
): string {
  return new Decimal(basicSalary)
    .plus(new Decimal(totalAllowances))
    .plus(new Decimal(overtimePay))
    .plus(new Decimal(bonus))
    .plus(new Decimal(thirteenthMonth))
    .toDecimalPlaces(2)
    .toString();
}

export function calculateNetSalary(
  grossSalary: string,
  employeeSSNIT: string,
  payeTax: string,
): string {
  return new Decimal(grossSalary)
    .minus(new Decimal(employeeSSNIT))
    .minus(new Decimal(payeTax))
    .toDecimalPlaces(2)
    .toString();
}
