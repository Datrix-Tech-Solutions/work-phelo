import {
  PayrollCountry,
  PayrollTaxPolicy,
} from '../../prisma/generated/client';
import { calculatePayrollForCountry } from './payroll-calculator.helper';

describe('calculatePayrollForCountry', () => {
  const ghanaSettings = {
    payrollCountry: PayrollCountry.GH,
    tier3Enabled: false,
    tier3Rate: null,
  };

  const baseValues = {
    basicSalary: '0',
    commissionAmount: '0',
    totalAllowances: '0',
    transportAmount: '0',
    otherDeductions: '0',
  };

  it('matches payslip net pay for the Buffalo payroll examples', () => {
    expect(
      calculatePayrollForCountry(
        {
          ...baseValues,
          basicSalary: '3842.68',
          totalAllowances: '1500',
        },
        ghanaSettings,
      ).netSalary,
    ).toBe('4250');

    expect(
      calculatePayrollForCountry(
        {
          ...baseValues,
          basicSalary: '3841.68',
          totalAllowances: '1500',
        },
        ghanaSettings,
      ).netSalary,
    ).toBe('4249.29');
  });

  it('keeps loans and advances as post-tax deductions', () => {
    const withoutDeduction = calculatePayrollForCountry(
      {
        ...baseValues,
        basicSalary: '3841.68',
        totalAllowances: '1500',
      },
      ghanaSettings,
    );
    const withDeduction = calculatePayrollForCountry(
      {
        ...baseValues,
        basicSalary: '3841.68',
        totalAllowances: '1500',
        otherDeductions: '100',
      },
      ghanaSettings,
    );

    expect(withDeduction.taxableIncome).toBe(withoutDeduction.taxableIncome);
    expect(withDeduction.payeTax).toBe(withoutDeduction.payeTax);
    expect(withDeduction.netSalary).toBe('4149.29');
  });

  it('keeps existing salary payroll calculation unchanged', () => {
    const result = calculatePayrollForCountry(
      { ...baseValues, basicSalary: '5000' },
      ghanaSettings,
    );

    expect(result).toMatchObject({
      basicSalary: '5000',
      commissionAmount: '0',
      grossSalary: '5000',
      employeeSSNIT: '275',
      taxableIncome: '4725',
      payeTax: '779.75',
      netSalary: '3945.25',
    });
  });

  it('calculates standard PAYE for commission-only employees', () => {
    const result = calculatePayrollForCountry(
      { ...baseValues, commissionAmount: '2000' },
      {
        ...ghanaSettings,
        taxPolicy: PayrollTaxPolicy.STANDARD_PAYE,
        commissionTaxable: true,
      },
    );

    expect(result).toMatchObject({
      basicSalary: '0',
      commissionAmount: '2000',
      grossSalary: '2000',
      employeeSSNIT: '0',
      taxableIncome: '2000',
      payeTax: '240.75',
      netSalary: '1759.25',
    });
  });

  it('uses fixed tax for commission-only employees when configured', () => {
    const result = calculatePayrollForCountry(
      { ...baseValues, commissionAmount: '2000' },
      {
        ...ghanaSettings,
        taxPolicy: PayrollTaxPolicy.FIXED_AMOUNT,
        fixedTaxAmount: '150',
      },
    );

    expect(result).toMatchObject({
      grossSalary: '2000',
      taxableIncome: '2000',
      payeTax: '150',
      netSalary: '1850',
    });
  });

  it('excludes non-taxable commission from standard PAYE while keeping it in gross and net', () => {
    const result = calculatePayrollForCountry(
      { ...baseValues, commissionAmount: '2000' },
      {
        ...ghanaSettings,
        taxPolicy: PayrollTaxPolicy.STANDARD_PAYE,
        commissionTaxable: false,
      },
    );

    expect(result).toMatchObject({
      grossSalary: '2000',
      taxableIncome: '0',
      payeTax: '0',
      netSalary: '2000',
    });
  });

  it('calculates salary-plus-commission employees in one gross pay base', () => {
    const result = calculatePayrollForCountry(
      { ...baseValues, basicSalary: '1000', commissionAmount: '500' },
      {
        ...ghanaSettings,
        taxPolicy: PayrollTaxPolicy.STANDARD_PAYE,
        commissionTaxable: true,
      },
    );

    expect(result).toMatchObject({
      basicSalary: '1000',
      commissionAmount: '500',
      grossSalary: '1500',
      employeeSSNIT: '55',
      taxableIncome: '1445',
      payeTax: '143.63',
      netSalary: '1301.38',
    });
  });

  it('supports exempt commission payroll items', () => {
    const result = calculatePayrollForCountry(
      { ...baseValues, commissionAmount: '2000' },
      {
        ...ghanaSettings,
        taxPolicy: PayrollTaxPolicy.EXEMPT,
        commissionTaxable: false,
      },
    );

    expect(result).toMatchObject({
      grossSalary: '2000',
      taxableIncome: '0',
      payeTax: '0',
      netSalary: '2000',
    });
  });
});
