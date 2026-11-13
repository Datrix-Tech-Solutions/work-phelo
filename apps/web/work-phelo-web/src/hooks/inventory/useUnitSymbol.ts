import { useInventoryUnits } from '@/hooks/inventory/useInventoryUnits';

/** The unit's symbol (its name if it has none) to show beside a quantity; a dash if unknown. */
export function useUnitSymbol() {
  const { units } = useInventoryUnits();
  return (unitId: string | null | undefined) => {
    const unit = units.find((u) => u.id === unitId);
    return unit ? unit.symbol || unit.name : '—';
  };
}
