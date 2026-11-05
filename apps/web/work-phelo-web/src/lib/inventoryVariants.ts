import type { VariantBalance } from '@/hooks/inventory/useItemVariants';

/** Stock of each variant of one item across all warehouses. */
export function variantStock(balances: VariantBalance[], itemId: string): Map<string, number> {
  const stock = new Map<string, number>();
  for (const b of balances) {
    if (b.itemId === itemId) stock.set(b.variant, (stock.get(b.variant) ?? 0) + b.quantity);
  }
  return stock;
}

/** Stock of one variant of an item in one warehouse. */
export function variantStockAt(
  balances: VariantBalance[],
  itemId: string,
  warehouseId: string,
  variant: string,
): number {
  return balances
    .filter((b) => b.itemId === itemId && b.locationId === warehouseId && b.variant === variant)
    .reduce((n, b) => n + b.quantity, 0);
}
