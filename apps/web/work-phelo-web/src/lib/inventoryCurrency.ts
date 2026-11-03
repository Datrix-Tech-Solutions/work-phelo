// Inventory has no per-tenant currency yet (the service stores none), so values are shown in this
// one. It matches the default of CurrencyInput. Swap for the tenant's base currency when available.
export const INVENTORY_CURRENCY = 'GHS';

/** "GHS 1,234.50" — a monetary inventory value with its currency code. */
export function formatInventoryValue(amount: number): string {
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${INVENTORY_CURRENCY} ${formatted}`;
}
