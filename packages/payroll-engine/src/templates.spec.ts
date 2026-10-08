import { calculatePayslip } from './engine';
import { checkConfiguration } from './validation';
import { PAYROLL_TEMPLATES } from './templates';

const template = (id: string) => PAYROLL_TEMPLATES.find((t) => t.id === id)!;
const idOf = (
  components: ReturnType<typeof template>['build'] extends () => infer R ? R : never,
  code: string,
) => components.find((c) => c.code === code)!.id;

describe('templates', () => {
  it('give each build its own ids and pass the configuration check', () => {
    for (const t of PAYROLL_TEMPLATES) {
      const a = t.build();
      const b = t.build();
      expect(new Set(a.map((c) => c.id)).size).toBe(a.length);
      expect(a.some((c) => b.some((d) => d.id === c.id))).toBe(false);
      expect(checkConfiguration(a, t.payslipType).errors).toEqual([]);
    }
  });

  it('Ghana matches the walkthrough: 5,000 basic and 300 exempt transport', () => {
    const c = template('ghana-salary').build();
    const r = calculatePayslip(c, { basic: 5000, commission: 0 }, { [idOf(c, 'TRANSPORT')]: 300 });
    expect(r.taxable).toBe(4725);
    expect(r.byId.get(idOf(c, 'PAYE'))?.amount).toBe(779.75);
    expect(r.gross).toBe(5300);
  });

  it('Kenya takes the personal relief off PAYE', () => {
    const c = template('kenya-salary').build();
    const r = calculatePayslip(c, { basic: 50000, commission: 0 }, {});
    // NSSF 6% of 50,000 = 3,000; taxable 47,000.
    const gross = 24000 * 0.1 + 8333 * 0.25 + (47000 - 32333) * 0.3;
    expect(r.taxable).toBe(47000);
    expect(r.byId.get(idOf(c, 'PAYE'))?.amount).toBe(Math.round(gross * 100) / 100);
    expect(r.byId.get(idOf(c, 'PAYE'))?.relief).toBe(2400);
    expect(r.byId.get(idOf(c, 'NSSF'))?.amount).toBe(3000);
  });

  it('Nigeria lowers the tax base by the relief without taking it from pay', () => {
    const c = template('nigeria-salary').build();
    const r = calculatePayslip(c, { basic: 100000, commission: 0 }, {});
    // Pension 8,000; relief 20,000 + max(16,666.67, 1,000) = 36,666.67; base 55,333.33 a month.
    const annual = (100000 - 8000 - (0.2 * 100000 + 200000 / 12)) * 12;
    // 21,000 on the first 300,000, 33,000 on the next 300,000 and 15% on the rest up to 1.1m.
    const tax = 300000 * 0.07 + 300000 * 0.11 + (annual - 600000) * 0.15;
    expect(r.byId.get(idOf(c, 'PAYE'))?.amount).toBeCloseTo(tax / 12, 1);
    expect(r.byId.get(idOf(c, 'CRA'))?.amount).toBeCloseTo(36666.67, 2);
    expect(r.totalDeductions).toBeCloseTo(8000 + tax / 12, 1);
  });
});
