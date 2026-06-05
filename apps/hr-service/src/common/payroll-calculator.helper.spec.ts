import { PayrollCountry } from '../../prisma/generated/client';
import { calculatePayrollForCountry } from './payroll-calculator.helper';

describe('calculatePayrollForCountry', () => {
  const ghanaSettings = {
    payrollCountry: PayrollCountry.GH,
    tier3Enabled: false,
    tier3Rate: null,
  };

  it('matches payslip net pay for the Buffalo payroll examples', () => {
    expect(
      calculatePayrollForCountry(
        {
          basicSalary: '3842.68',
          totalAllowances: '1500',
          transportAmount: '0',
          otherDeductions: '0',
        },
        ghanaSettings,
      ).netSalary,
    ).toBe('4250');

    expect(
      calculatePayrollForCountry(
        {
          basicSalary: '3841.68',
          totalAllowances: '1500',
          transportAmount: '0',
          otherDeductions: '0',
        },
        ghanaSettings,
      ).netSalary,
    ).toBe('4249.29');
  });

  it('keeps loans and advances as post-tax deductions', () => {
    const withoutDeduction = calculatePayrollForCountry(
      {
        basicSalary: '3841.68',
        totalAllowances: '1500',
        transportAmount: '0',
        otherDeductions: '0',
      },
      ghanaSettings,
    );
    const withDeduction = calculatePayrollForCountry(
      {
        basicSalary: '3841.68',
        totalAllowances: '1500',
        transportAmount: '0',
        otherDeductions: '100',
      },
      ghanaSettings,
    );

    expect(withDeduction.taxableIncome).toBe(withoutDeduction.taxableIncome);
    expect(withDeduction.payeTax).toBe(withoutDeduction.payeTax);
    expect(withDeduction.netSalary).toBe('4149.29');
  });
});
