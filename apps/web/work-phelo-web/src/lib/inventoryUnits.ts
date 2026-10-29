import type { CreatableOption } from '@/components/atoms/CreatableSearchSelect';

/** Common units of measure, suggested in the unit form. Symbols are unique across the list. */
export const COMMON_UNITS = [
  { name: 'Piece', symbol: 'pc' },
  { name: 'Pair', symbol: 'pr' },
  { name: 'Dozen', symbol: 'doz' },
  { name: 'Set', symbol: 'set' },
  { name: 'Box', symbol: 'box' },
  { name: 'Carton', symbol: 'ctn' },
  { name: 'Pack', symbol: 'pack' },
  { name: 'Bag', symbol: 'bag' },
  { name: 'Roll', symbol: 'roll' },
  { name: 'Bottle', symbol: 'btl' },
  { name: 'Milligram', symbol: 'mg' },
  { name: 'Gram', symbol: 'g' },
  { name: 'Kilogram', symbol: 'kg' },
  { name: 'Tonne', symbol: 't' },
  { name: 'Ounce', symbol: 'oz' },
  { name: 'Pound', symbol: 'lb' },
  { name: 'Millilitre', symbol: 'mL' },
  { name: 'Litre', symbol: 'L' },
  { name: 'Gallon', symbol: 'gal' },
  { name: 'Millimetre', symbol: 'mm' },
  { name: 'Centimetre', symbol: 'cm' },
  { name: 'Metre', symbol: 'm' },
  { name: 'Inch', symbol: 'in' },
  { name: 'Foot', symbol: 'ft' },
  { name: 'Yard', symbol: 'yd' },
  { name: 'Square Metre', symbol: 'm²' },
  { name: 'Cubic Metre', symbol: 'm³' },
] as const;

export const UNIT_NAME_OPTIONS: CreatableOption[] = COMMON_UNITS.map((u) => ({
  value: u.name,
  label: u.name,
}));

export const UNIT_SYMBOL_OPTIONS: CreatableOption[] = COMMON_UNITS.map((u) => ({
  value: u.symbol,
  label: `${u.symbol} (${u.name})`,
}));

/** The symbol of the common unit with this name, if it is one (case-insensitive). */
export function symbolForUnitName(name: string): string | undefined {
  const key = name.trim().toLowerCase();
  return COMMON_UNITS.find((u) => u.name.toLowerCase() === key)?.symbol;
}

/** The name of the common unit with this symbol, if it is one (case-sensitive: `m` is not `M`). */
export function nameForUnitSymbol(symbol: string): string | undefined {
  return COMMON_UNITS.find((u) => u.symbol === symbol.trim())?.name;
}
