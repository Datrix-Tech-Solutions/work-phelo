import { validateComponents } from './payroll-configuration.validation';

const base = {
  rounding: 'cent',
  tags: { taxable: false, pensionable: false, reducesTaxable: false },
};

const ssnit = {
  ...base,
  id: 'ss',
  code: 'SSNIT',
  name: 'SSNIT (employee)',
  kind: 'deduction',
  method: 'percent',
  enabled: true,
  role: 'employee_social_security',
  base: 'basic',
  params: { rate: 5.5, baseCap: 69000 },
  tags: { taxable: false, pensionable: false, reducesTaxable: true },
};

const paye = {
  ...base,
  id: 'paye',
  code: 'PAYE',
  name: 'PAYE',
  kind: 'deduction',
  method: 'bands',
  enabled: true,
  role: 'income_tax',
  base: 'taxable_income',
  params: {
    period: 'monthly',
    bands: [
      { upTo: 490, rate: 0 },
      { upTo: 600, rate: 5 },
      { upTo: null, rate: 35 },
    ],
  },
};

const credit = {
  ...base,
  id: 'relief',
  code: 'RELIEF',
  name: 'Personal relief',
  kind: 'credit',
  method: 'fixed',
  enabled: true,
  role: 'tax_credit',
  base: 'component',
  reduces: 'paye',
  params: { amount: 2400 },
};

const run = (components: unknown[]) => validateComponents(components);

describe('validateComponents', () => {
  it('accepts a normal set of components', () => {
    const result = run([ssnit, paye, credit]);
    expect(result.errors).toEqual([]);
    expect(result.components).toHaveLength(3);
  });

  it('keeps only the known fields', () => {
    const result = run([
      { ...ssnit, secret: 'x', params: { rate: 5, evil: 1 } },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.components[0]).not.toHaveProperty('secret');
    expect(result.components[0].params).toEqual({ rate: 5 });
  });

  it('rejects anything that is not a list', () => {
    expect(validateComponents('nope').errors).toEqual([
      'Components must be a list.',
    ]);
  });

  it('rejects an unknown kind, method or rounding', () => {
    const errors = run([
      { ...ssnit, kind: 'bonus', method: 'magic', rounding: 'sideways' },
    ]).errors.join(' ');
    expect(errors).toContain('kind must be');
    expect(errors).toContain('method must be');
    expect(errors).toContain('rounding must be');
  });

  it("rejects a method the kind can't use", () => {
    const { errors } = run([
      { ...ssnit, kind: 'earning', method: 'bands', role: 'salary_wages' },
    ]);
    expect(errors.join(' ')).toContain("an earning can't use the bands method");
  });

  it("rejects a role the kind can't have", () => {
    const { errors } = run([{ ...ssnit, role: 'salary_wages' }]);
    expect(errors.join(' ')).toContain(
      "a deduction can't have the salary_wages role",
    );
  });

  it('rejects rates outside 0 to 100 and negative amounts', () => {
    const { errors } = run([{ ...ssnit, params: { rate: 120, min: -1 } }]);
    expect(errors.join(' ')).toContain('rate must be a rate from 0 to 100');
    expect(errors.join(' ')).toContain('min must be a number from 0 up');
  });

  it('requires bands to go up and the last one to be open', () => {
    const wrongOrder = run([
      {
        ...paye,
        params: {
          period: 'monthly',
          bands: [
            { upTo: 600, rate: 5 },
            { upTo: 490, rate: 10 },
            { upTo: null, rate: 35 },
          ],
        },
      },
    ]);
    expect(wrongOrder.errors.join(' ')).toContain(
      'must go up from top to bottom',
    );

    const closedLast = run([
      {
        ...paye,
        params: {
          period: 'monthly',
          bands: [
            { upTo: 490, rate: 0 },
            { upTo: 600, rate: 5 },
          ],
        },
      },
    ]);
    expect(closedLast.errors.join(' ')).toContain(
      'last band must have no upper limit',
    );
  });

  it('checks the formula text', () => {
    const bad = run([
      { ...ssnit, method: 'formula', params: { expr: 'basic; DROP TABLE' } },
    ]);
    expect(bad.errors.join(' ')).toContain('the formula must be');
    const good = run([
      {
        ...ssnit,
        method: 'formula',
        params: { expr: 'max(0, gross * 0.01 - PAYE)' },
      },
    ]);
    expect(good.errors).toEqual([]);
  });

  it('refuses duplicate ids and codes', () => {
    const { errors } = run([ssnit, { ...ssnit }]);
    expect(errors.join(' ')).toContain('used twice');
  });

  it('refuses an earning calculated on pay that includes itself', () => {
    const { errors } = run([
      {
        ...base,
        id: 'e',
        code: 'HOUSING',
        name: 'Housing',
        kind: 'earning',
        method: 'percent',
        enabled: true,
        base: 'gross',
        params: { rate: 10 },
      },
    ]);
    expect(errors.join(' ')).toContain(
      'can only be calculated on the basic salary',
    );
  });

  it('refuses a deduction that reduces taxable income and is calculated on it', () => {
    const { errors } = run([
      {
        ...paye,
        tags: { taxable: false, pensionable: false, reducesTaxable: true },
      },
    ]);
    expect(errors.join(' ')).toContain(
      "can't also be calculated on taxable income",
    );
  });

  describe('variable amounts', () => {
    const variable = {
      ...base,
      id: 'v',
      code: 'TRANSPORT',
      name: 'Transport',
      kind: 'earning',
      method: 'variable',
      enabled: true,
      base: 'basic',
      params: { source: 'allowance', allowanceType: 'TRANSPORT' },
    };

    it('accepts an allowance with its type', () => {
      expect(run([variable]).errors).toEqual([]);
    });

    it('needs the allowance type', () => {
      const { errors } = run([
        { ...variable, params: { source: 'allowance' } },
      ]);
      expect(errors.join(' ')).toContain('choose which allowance type');
    });

    it("doesn't let an earning take loans", () => {
      const { errors } = run([{ ...variable, params: { source: 'loans' } }]);
      expect(errors.join(' ')).toContain("can't take its amount from loans");
    });
  });

  describe('tax credits', () => {
    it('must reduce a deduction that exists', () => {
      const { errors } = run([ssnit, { ...credit, reduces: 'missing' }]);
      expect(errors.join(' ')).toContain('choose which deduction it reduces');
    });

    it("can't reduce a deduction that isn't deducted from pay", () => {
      const { errors } = run([
        { ...paye, tags: { ...paye.tags, deductedFromPay: false } },
        credit,
      ]);
      expect(errors.join(' ')).toContain("isn't deducted from pay");
    });

    it('needs a deduction to be calculated on when it uses a rate', () => {
      const { errors } = run([
        ssnit,
        paye,
        {
          ...credit,
          method: 'percent',
          params: { rate: 50 },
          baseComponentId: 'nope',
        },
      ]);
      expect(errors.join(' ')).toContain(
        'choose which deduction it is calculated on',
      );
    });

    it('lets a rate credit be based on a deduction', () => {
      const { errors } = run([
        ssnit,
        paye,
        {
          ...credit,
          method: 'percent',
          params: { rate: 50 },
          baseComponentId: 'ss',
        },
      ]);
      expect(errors).toEqual([]);
    });

    it('only a credit may be calculated on another component', () => {
      const { errors } = run([{ ...ssnit, base: 'component' }]);
      expect(errors.join(' ')).toContain(
        'only a tax credit can be calculated on another component',
      );
    });
  });

  it('drops the links of a component saved on its own', () => {
    const result = validateComponents([{ ...credit, baseComponentId: 'ss' }], {
      standalone: true,
    });
    expect(result.errors).toEqual([]);
    expect(result.components[0]).not.toHaveProperty('reduces');
    expect(result.components[0]).not.toHaveProperty('baseComponentId');
  });
});
