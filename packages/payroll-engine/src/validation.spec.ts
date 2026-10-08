import { checkConfiguration, checkReminders } from './validation';
import { component, ghanaMonthly, paye, ssnitEmployer, ssnitTier1 } from './payroll.fixtures';

const commissionEarning = () =>
  component({
    code: 'COMM_EARN',
    name: 'Commission',
    kind: 'earning',
    method: 'percent',
    base: 'commission',
    params: { rate: 10 },
    tags: { taxable: true },
  });

describe('checkConfiguration', () => {
  it('accepts the Ghana monthly set-up with nothing to fix', () => {
    const result = checkConfiguration(ghanaMonthly(), 'monthly');
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  describe('commission', () => {
    it('refuses a commission payslip with nothing built from the commission figure', () => {
      expect(checkConfiguration([paye()], 'commission').errors.join(' ')).toContain(
        'Nothing uses the commission figure yet',
      );
    });

    it('only warns on a monthly + commission payslip, which still pays a salary', () => {
      const result = checkConfiguration([paye()], 'monthly_commission');
      expect(result.errors).toEqual([]);
      expect(result.warnings.join(' ')).toContain('Nothing uses the commission figure yet');
    });

    it('warns when a component uses a figure the payslip type does not have', () => {
      const warning = checkConfiguration([commissionEarning()], 'monthly').warnings.join(' ');
      expect(warning).toContain("which Salary payslips don't have");
    });
  });

  describe('accounting roles', () => {
    it('counts a basic salary as paying Salary and wages', () => {
      expect(checkConfiguration([], 'monthly').warnings).toEqual([]);
    });

    it('needs a commission earning for Salary and wages on a commission payslip', () => {
      const warnings = checkConfiguration([commissionEarning()], 'commission').warnings;
      expect(warnings).toEqual([]);
      expect(checkConfiguration([paye()], 'commission').warnings.join(' ')).toContain(
        "Salary and wages isn't assigned",
      );
    });

    it('does not require tax or social security', () => {
      const result = checkConfiguration([commissionEarning()], 'commission');
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('flags a deduction taken from pay that has no role yet', () => {
      const noRole = { ...ssnitTier1(), role: undefined };
      expect(checkConfiguration([noRole], 'monthly').warnings.join(' ')).toContain(
        'has no accounting role yet',
      );
    });
  });

  describe('blocking problems', () => {
    it('stops duplicate codes', () => {
      const errors = checkConfiguration(
        [ssnitTier1(), { ...ssnitTier1(), id: 'other' }],
        'monthly',
      ).errors;
      expect(errors.join(' ')).toContain('both use the code SSNIT_T1');
    });

    it('stops codes that are built-in names', () => {
      const clash = component({
        code: 'COMMISSION',
        name: 'Sales',
        kind: 'earning',
        method: 'fixed',
      });
      expect(checkConfiguration([clash], 'monthly').errors.join(' ')).toContain('reserved');
    });

    it('stops bands that do not go up', () => {
      const bad = {
        ...paye(),
        params: {
          period: 'monthly' as const,
          bands: [
            { upTo: 600, rate: 5 },
            { upTo: 500, rate: 10 },
            { upTo: null, rate: 35 },
          ],
        },
      };
      expect(checkConfiguration([bad], 'monthly').errors.join(' ')).toContain('must go up');
    });

    it('stops rates outside 0 to 100 and negative amounts', () => {
      const bad = { ...ssnitTier1(), params: { rate: 150, min: -1 } };
      const errors = checkConfiguration([bad], 'monthly').errors.join(' ');
      expect(errors).toContain('rate must be from 0 to 100');
      expect(errors).toContain("amounts can't be negative");
    });

    it('stops a tax credit with no deduction to reduce', () => {
      const credit = component({
        code: 'REL',
        name: 'Relief',
        kind: 'credit',
        method: 'fixed',
        base: 'component',
      });
      expect(checkConfiguration([credit], 'monthly').errors.join(' ')).toContain('reduces');
    });

    it('stops calculation loops', () => {
      const a = component({
        code: 'A',
        name: 'A',
        kind: 'deduction',
        method: 'formula',
        params: { expr: 'B' },
      });
      const b = component({
        code: 'B',
        name: 'B',
        kind: 'deduction',
        method: 'formula',
        params: { expr: 'A' },
      });
      expect(checkConfiguration([a, b], 'monthly').errors.join(' ')).toContain('loop');
    });

    it('stops an allowance type left unchosen', () => {
      const allowance = component({
        code: 'ALLOW',
        name: 'Allowance',
        kind: 'earning',
        method: 'variable',
        params: { source: 'allowance' },
      });
      expect(checkConfiguration([allowance], 'monthly').errors.join(' ')).toContain(
        'allowance type',
      );
    });

    it('warns when two components pay the same allowance', () => {
      const make = (code: string) =>
        component({
          code,
          name: code,
          kind: 'earning',
          method: 'variable',
          params: { source: 'allowance', allowanceType: 'TRANSPORT' },
        });
      expect(checkConfiguration([make('A'), make('B')], 'monthly').warnings.join(' ')).toContain(
        'paid twice',
      );
    });
  });
});

describe('checkReminders', () => {
  it('lists the optional parts that are not set up, in one reminder', () => {
    const [reminder] = checkReminders([]);
    expect(reminder).toContain('Income tax');
    expect(reminder).toContain('Other deductions');
    expect(reminder).toContain('only a reminder');
  });

  it('shrinks as parts are added and disappears when all are set up', () => {
    const loan = component({
      code: 'LOANS',
      name: 'Loans',
      kind: 'deduction',
      method: 'variable',
      role: 'other_deductions',
    });
    const all = [...ghanaMonthly(), loan];
    expect(checkReminders(all)).toEqual([]);
    expect(checkReminders([paye(), ssnitEmployer()])[0]).not.toContain('Income tax');
  });

  it('counts a switched-off component as missing', () => {
    expect(checkReminders([{ ...paye(), enabled: false }])[0]).toContain('Income tax');
  });
});
