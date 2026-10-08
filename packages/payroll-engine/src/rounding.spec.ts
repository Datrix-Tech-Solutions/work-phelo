import Decimal from 'decimal.js';
import { roundAmount, roundDown, roundHalfUp } from './rounding';

Decimal.config({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

describe('rounding', () => {
  it('rounds halves up, which plain floating point does not', () => {
    // 1003 x 0.5% is exactly 5.015; Math.round(x * 100) / 100 gives 5.01.
    expect(roundHalfUp((1003 * 0.5) / 100, 2)).toBe(5.02);
    expect(roundHalfUp(1.005, 2)).toBe(1.01);
    expect(roundHalfUp(2.5, 0)).toBe(3);
  });

  it('rounds halves away from zero for negatives', () => {
    expect(roundHalfUp(-1.005, 2)).toBe(-1.01);
    expect(roundHalfUp(-2.5, 0)).toBe(-3);
  });

  it('cuts off towards zero when rounding down', () => {
    expect(roundDown(5.019, 2)).toBe(5.01);
    expect(roundDown(-5.019, 2)).toBe(-5.01);
  });

  it('applies each rounding setting', () => {
    expect(roundAmount(1234.567, 'cent')).toBe(1234.57);
    expect(roundAmount(1234.567, 'whole')).toBe(1235);
    expect(roundAmount(1234.567, 'down')).toBe(1234.56);
    expect(roundAmount(1234.567, 'none')).toBe(1234.567);
  });

  it('never returns negative zero', () => {
    expect(Object.is(roundHalfUp(-0.001, 2), -0)).toBe(false);
  });

  it('matches exact decimal arithmetic across many amounts and rates', () => {
    const rates = ['5.5', '0.5', '13', '17.5', '2.75', '1.5', '8', '25', '0.125', '35'];
    let checked = 0;
    for (let amount = -500; amount <= 4000; amount += 0.5) {
      for (const rate of rates) {
        const exact = new Decimal(amount).times(rate).div(100);
        const float = (amount * parseFloat(rate)) / 100;
        // `|| 0` because decimal.js keeps a negative sign on a tiny amount rounded to nothing.
        expect(roundAmount(float, 'cent')).toBe(exact.toDecimalPlaces(2).toNumber() || 0);
        expect(roundAmount(float, 'whole')).toBe(exact.toDecimalPlaces(0).toNumber() || 0);
        expect(roundAmount(float, 'down')).toBe(
          exact.toDecimalPlaces(2, Decimal.ROUND_DOWN).toNumber() || 0,
        );
        checked += 3;
      }
    }
    expect(checked).toBeGreaterThan(100000);
  });
});
