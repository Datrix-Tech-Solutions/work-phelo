import type { RoundingMode } from './types';

/**
 * Money rounding that gives the same answer as exact decimal arithmetic with round-half-up, which
 * is what the server uses. Plain `Math.round(x * 100) / 100` doesn't: 1003 × 0.5% is exactly 5.015
 * and should round up to 5.02, but the floating-point product lands just below it and rounds down
 * to 5.01.
 *
 * The fix is to drop the floating-point noise first (a double only holds 15 reliable digits), then
 * move the decimal point by changing the exponent instead of multiplying.
 */

/** Removes the tiny error floating-point arithmetic leaves behind, such as 5.014999999999999. */
const clean = (x: number) => Number(x.toPrecision(15));

/** Moves the decimal point by `places` through the exponent, so there is no multiplication error. */
function shift(x: number, places: number): number {
  const [mantissa, exponent = '0'] = String(x).split('e');
  return Number(`${mantissa}e${Number(exponent) + places}`);
}

/** Rounds to `places` decimal places; halves go away from zero, like the server. */
export function roundHalfUp(x: number, places: number): number {
  const magnitude = Math.round(shift(clean(Math.abs(x)), places));
  return Math.sign(x) * shift(magnitude, -places) || 0;
}

/** Cuts off everything past `places` decimal places, towards zero. */
export function roundDown(x: number, places: number): number {
  const magnitude = Math.floor(shift(clean(Math.abs(x)), places));
  return Math.sign(x) * shift(magnitude, -places) || 0;
}

/** Applies a component's rounding setting to an amount. */
export function roundAmount(x: number, mode: RoundingMode): number {
  if (mode === 'whole') return roundHalfUp(x, 0);
  if (mode === 'down') return roundDown(x, 2);
  if (mode === 'none') return x;
  return roundHalfUp(x, 2);
}
