import { evaluateFormula, formulaRefs } from './formula';

const evaluate = (expr: string, names: Record<string, number> = {}) =>
  evaluateFormula(expr, (name) => {
    if (name in names) return names[name];
    throw new Error(`Unknown name "${name}"`);
  });

describe('formula', () => {
  it('follows the order of arithmetic', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14);
    expect(evaluate('(2 + 3) * 4')).toBe(20);
    expect(evaluate('10 - 4 - 3')).toBe(3);
    expect(evaluate('-5 + 2')).toBe(-3);
  });

  it('reads names and functions', () => {
    expect(evaluate('max(0, gross * 0.01 - PAYE)', { gross: 4000, PAYE: 30 })).toBe(10);
    expect(evaluate('min(5, 3)')).toBe(3);
    expect(evaluate('round(2.5) + floor(2.9) + ceil(2.1)')).toBe(8);
  });

  it('refuses division by zero and unknown functions', () => {
    expect(() => evaluate('1 / 0')).toThrow('Division by zero');
    expect(() => evaluate('boom(1)')).toThrow('Unknown function');
  });

  it('refuses malformed text', () => {
    expect(() => evaluate('1 +')).toThrow();
    expect(() => evaluate('(1 + 2')).toThrow('Missing closing bracket');
    expect(() => evaluate('1 ; 2')).toThrow('Unexpected ";"');
  });

  it('lists the names a formula uses, not its functions', () => {
    expect(formulaRefs('max(0, gross * 0.01 - PAYE)')).toEqual(['gross', 'paye']);
    expect(formulaRefs('1 +')).toEqual([]);
  });
});
