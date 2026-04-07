// lib/payrollCalculations.ts

export interface PayrollInput {
  basicSalary: number;
  allowances: number;
}

export interface PayrollResult {
  basicSalary: number;
  allowances: number;
  grossSalary: number;
  employeeSSNIT: number;
  taxableIncome: number;
  paye: number;
  netSalary: number;
  employerSSNIT: number;
  totalEmployerCost: number;
}

/**
 * Ghana 2024/2025 PAYE Tax Bands (Simplified)
 * Note: You should confirm the exact brackets with your accountant
 */
function calculatePAYE(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;

  let tax = 0;

  // First band: Up to GHS 1,920 per month (≈ GHS 23,040 annually) - often tax free or low rate
  if (taxableIncome <= 1920) {
    tax = taxableIncome * 0.05; // 5%
  }
  // Second band
  else if (taxableIncome <= 4500) {
    tax = 1920 * 0.05 + (taxableIncome - 1920) * 0.1;
  }
  // Third band
  else if (taxableIncome <= 9000) {
    tax = 1920 * 0.05 + 2580 * 0.1 + (taxableIncome - 4500) * 0.175;
  }
  // Above GHS 9,000
  else {
    tax = 1920 * 0.05 + 2580 * 0.1 + 4500 * 0.175 + (taxableIncome - 9000) * 0.25;
  }

  return Math.round(tax);
}

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const { basicSalary, allowances } = input;

  const grossSalary = basicSalary + allowances;

  const employeeSSNIT = Math.round(basicSalary * 0.055); // 5.5%
  const taxableIncome = grossSalary - employeeSSNIT;

  const paye = calculatePAYE(taxableIncome);

  const netSalary = Math.round(taxableIncome - paye);

  const employerSSNIT = Math.round(basicSalary * 0.13); // 13%
  const totalEmployerCost = grossSalary + employerSSNIT;

  return {
    basicSalary: Math.round(basicSalary),
    allowances: Math.round(allowances),
    grossSalary: Math.round(grossSalary),
    employeeSSNIT,
    taxableIncome: Math.round(taxableIncome),
    paye,
    netSalary,
    employerSSNIT,
    totalEmployerCost: Math.round(totalEmployerCost),
  };
}
