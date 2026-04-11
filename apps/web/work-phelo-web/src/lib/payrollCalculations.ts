export type Country = 'GH' | 'NG' | 'KE';

export interface PayrollInput {
  country: Country;
  basicSalary: number;
  allowances: number;
  // Optional country-specific fields
  otherDeductions?: number; // e.g. pension, NHIF, etc.
}

export interface PayrollResult {
  employeeSSNIT: number;
  employerSSNIT: number;
  basicSalary: number;
  allowances: number;
  grossSalary: number;
  employeePensionOrSSNIT: number; // Ghana SSNIT 5.5%, Nigeria Pension 8%, Kenya NSSF
  taxableIncome: number;
  paye: number;
  netSalary: number;
  employerPensionOrSSNIT: number; // Ghana 13%, Nigeria 10%, Kenya NSSF employer portion
  totalEmployerCost: number;
  currency: string;
}

/* ── Country-specific PAYE Calculators ── */

function calculatePAYE_GH(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;

  let tax = 0;

  if (taxableIncome <= 1920) {
    tax = taxableIncome * 0.05;
  } else if (taxableIncome <= 4500) {
    tax = 1920 * 0.05 + (taxableIncome - 1920) * 0.1;
  } else if (taxableIncome <= 9000) {
    tax = 1920 * 0.05 + 2580 * 0.1 + (taxableIncome - 4500) * 0.175;
  } else {
    tax = 1920 * 0.05 + 2580 * 0.1 + 4500 * 0.175 + (taxableIncome - 9000) * 0.25;
  }

  return Math.round(tax);
}

function calculatePAYE_NG(taxableIncomeAnnual: number): number {
  // Using latest 2025/2026 Nigeria Tax Act bands (annual)
  const bands = [
    { threshold: 800000, rate: 0 },
    { threshold: 3000000, rate: 0.15 },
    { threshold: 12000000, rate: 0.18 },
    { threshold: 25000000, rate: 0.21 },
    { threshold: 50000000, rate: 0.23 },
    { threshold: Infinity, rate: 0.25 },
  ];

  let tax = 0;
  let previous = 0;

  for (const band of bands) {
    const taxableInBand = Math.min(taxableIncomeAnnual, band.threshold) - previous;
    if (taxableInBand > 0) {
      tax += taxableInBand * band.rate;
    }
    previous = band.threshold;
    if (taxableIncomeAnnual <= band.threshold) break;
  }

  return Math.round(tax / 12); // Convert annual tax to monthly
}

function calculatePAYE_KE(taxableIncome: number): number {
  // Kenya PAYE monthly bands (effective 2023–2025)
  if (taxableIncome <= 24000) return Math.round(taxableIncome * 0.1);
  if (taxableIncome <= 32333) return Math.round(24000 * 0.1 + (taxableIncome - 24000) * 0.25);
  if (taxableIncome <= 500000)
    return Math.round(24000 * 0.1 + 8333 * 0.25 + (taxableIncome - 32333) * 0.3);
  if (taxableIncome <= 800000)
    return Math.round(24000 * 0.1 + 8333 * 0.25 + 467667 * 0.3 + (taxableIncome - 500000) * 0.325);

  return Math.round(
    24000 * 0.1 + 8333 * 0.25 + 467667 * 0.3 + 300000 * 0.325 + (taxableIncome - 800000) * 0.35,
  );
}

/* ── Main Payroll Calculator ── */

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const { country, basicSalary, allowances, otherDeductions = 0 } = input;

  const grossSalary = basicSalary + allowances;

  let employeeContribution = 0;
  let employerContribution = 0;
  let paye = 0;
  let currency = 'GHS';

  switch (country) {
    case 'GH':
      employeeContribution = Math.round(basicSalary * 0.055); // SSNIT 5.5%
      employerContribution = Math.round(basicSalary * 0.13); // SSNIT 13%
      const taxableGH = grossSalary - employeeContribution;
      paye = calculatePAYE_GH(taxableGH);
      currency = 'GHS';
      break;

    case 'NG':
      employeeContribution = Math.round(basicSalary * 0.08); // Pension 8%
      employerContribution = Math.round(basicSalary * 0.1); // Pension 10%
      const taxableAnnualNG = (grossSalary - employeeContribution) * 12;
      paye = calculatePAYE_NG(taxableAnnualNG);
      currency = 'NGN';
      break;

    case 'KE':
      employeeContribution = Math.round(basicSalary * 0.06); // Approximate NSSF (adjust based on exact tiers)
      employerContribution = Math.round(basicSalary * 0.06);
      const taxableKE = grossSalary - employeeContribution - otherDeductions;
      paye = calculatePAYE_KE(taxableKE);
      currency = 'KES';
      break;
  }

  const taxableIncome = grossSalary - employeeContribution - otherDeductions;
  const netSalary = Math.round(taxableIncome - paye);
  const totalEmployerCost = Math.round(grossSalary + employerContribution);

  return {
    basicSalary: Math.round(basicSalary),
    allowances: Math.round(allowances),
    grossSalary: Math.round(grossSalary),
    employeePensionOrSSNIT: employeeContribution,
    employeeSSNIT: employeeContribution,
    taxableIncome: Math.round(taxableIncome),
    paye,
    netSalary,
    employerPensionOrSSNIT: employerContribution,
    employerSSNIT: employerContribution,
    totalEmployerCost,
    currency,
  };
}
