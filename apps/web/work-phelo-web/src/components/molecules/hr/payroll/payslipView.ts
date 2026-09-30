import type { PayrollItem } from '@/types/hr';
import { formatPayrollMoney, getPayrollLabels } from '@/lib/payrollDisplay';
import { payrollMonthLabel } from '@/lib/payrollUtils';

export interface PayslipRow {
  label: string;
  value: string;
}

export interface PayslipView {
  period: string;
  /** The employee block, one line each: name; job title, department; employee no.; date. */
  employeeLines: string[];
  earnings: PayslipRow[];
  grossSalary: string;
  deductions: PayslipRow[];
  totalDeductions: string;
  netSalary: string;
}

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

/** What a payslip shows — the same rows and rules as the HR payslip card (PAYE split for
 *  salary + commission, statutory labels per country, only non-zero lines), as plain data so
 *  a printable layout can render it however the paper needs. */
export function buildPayslipView(item: PayrollItem): PayslipView {
  const country = item.payrollRun?.payrollCountry;
  const currency = item.payrollRun?.payrollCurrency;
  const labels = getPayrollLabels(country);
  const money = (v: string | number) => formatPayrollMoney(v, currency, country);
  const positive = (v: string | number | null | undefined) => {
    const amount = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  };

  const earnings: PayslipRow[] = [];
  if (positive(item.basicSalary)) {
    earnings.push({ label: 'Basic Salary', value: money(item.basicSalary) });
  }
  if (positive(item.commissionAmount)) {
    earnings.push({ label: 'Commission', value: money(item.commissionAmount) });
  }
  if (item.allowanceItems?.length) {
    for (const a of item.allowanceItems) {
      if (positive(a.amount)) earnings.push({ label: a.name, value: money(a.amount) });
    }
  } else {
    if (positive(item.transportAmount)) {
      earnings.push({ label: 'Transport Allowance', value: money(item.transportAmount) });
    }
    if (positive(item.totalAllowances)) {
      earnings.push({ label: 'Allowances', value: money(item.totalAllowances) });
    }
  }
  if (positive(item.overtimePay))
    earnings.push({ label: 'Overtime', value: money(item.overtimePay) });
  if (positive(item.bonus)) earnings.push({ label: 'Bonus', value: money(item.bonus) });
  if (positive(item.thirteenthMonth)) {
    earnings.push({ label: '13th Month', value: money(item.thirteenthMonth) });
  }

  const deductions: PayslipRow[] = [];
  const addDeduction = (label: string, amount: string | number) => {
    if (positive(amount)) deductions.push({ label, value: `(${money(positive(amount))})` });
  };
  const isBoth = item.compensationTypeSnapshot === 'SALARY_PLUS_COMMISSION';
  const commissionTax = isBoth ? r2(parseFloat(item.commissionAmount) * 0.1) : 0;

  addDeduction(labels.employeeLabel, item.employeeSSNIT);
  if (isBoth) {
    addDeduction('PAYE Tax', r2(parseFloat(item.payeTax) - commissionTax));
    addDeduction('Commission Tax (10%)', commissionTax);
  } else {
    addDeduction(
      item.compensationTypeSnapshot === 'COMMISSION'
        ? 'Commission Tax (10%)'
        : item.taxPolicySnapshot === 'FIXED_AMOUNT'
          ? 'PAYE Tax (Fixed)'
          : 'PAYE Tax',
      item.payeTax,
    );
  }
  const tier3Rate = item.payrollRun?.tier3Rate;
  addDeduction(
    item.payrollRun?.tier3Enabled && tier3Rate
      ? `Tier 3 (${parseFloat(tier3Rate).toFixed(2).replace(/\.00$/, '')}%)`
      : 'Tier 3',
    item.tier3Employee,
  );
  if (item.deductionItems?.length) {
    for (const d of item.deductionItems) addDeduction(d.name, d.amount);
  } else {
    addDeduction('Deductions', item.otherDeductions);
  }

  const period = item.payrollRun
    ? payrollMonthLabel(item.payrollRun.month, item.payrollRun.year)
    : '—';
  // The pay date once the run has been paid; until then the month it covers.
  const paidAt = item.payrollRun?.paidAt;
  const date = paidAt
    ? new Date(paidAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : period;

  const employee = item.employee;
  const employeeLines = [
    employee ? `${employee.firstName} ${employee.lastName}` : '',
    [employee?.jobTitle, employee?.department].filter(Boolean).join(', '),
    employee?.employeeNumber ?? '',
    date,
  ].filter(Boolean);

  return {
    period,
    employeeLines,
    earnings,
    grossSalary: money(item.grossSalary),
    deductions,
    totalDeductions: money(item.totalDeductions),
    netSalary: money(item.netSalary),
  };
}
