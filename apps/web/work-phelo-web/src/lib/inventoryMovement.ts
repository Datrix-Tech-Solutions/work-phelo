import type { TypeChipColor } from '@/components/atoms/TypeChip';
import type { StockMovementStatus, StockMovementType } from '@/hooks/inventory/useStockMovements';

export const MOVEMENT_TYPE_LABEL: Record<StockMovementType, string> = {
  STOCK_IN: 'Stock In',
  STOCK_OUT: 'Stock Out',
  TRANSFER: 'Transfer',
  ADJUSTMENT: 'Adjustment',
};

export const MOVEMENT_TYPE_COLOR: Record<StockMovementType, TypeChipColor> = {
  STOCK_IN: 'green',
  STOCK_OUT: 'red',
  TRANSFER: 'blue',
  ADJUSTMENT: 'amber',
};

export const MOVEMENT_STATUS_BADGE: Record<
  StockMovementStatus,
  { label: string; variant: 'success' | 'warning' | 'neutral' | 'info' | 'danger' }
> = {
  DRAFT: { label: 'Draft', variant: 'info' },
  PENDING: { label: 'Pending Approval', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
  REVERSED: { label: 'Reversed', variant: 'danger' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
};

// Values are the inventory service's reason and purpose codes.
export const ADJUSTMENT_REASONS = [
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'LOSS', label: 'Loss' },
  { value: 'THEFT', label: 'Theft' },
  { value: 'PHYSICAL_COUNT_DIFFERENCE', label: 'Physical Count Difference' },
  { value: 'DATA_CORRECTION', label: 'Data Correction' },
  { value: 'EXPIRED_GOODS', label: 'Expired Goods' },
  { value: 'VARIANT_ASSIGNMENT', label: 'Variant Assignment' },
  { value: 'OTHER', label: 'Other' },
];

export const STOCK_OUT_PURPOSES = [
  { value: 'SALE', label: 'Sale' },
  { value: 'INTERNAL_USE', label: 'Internal Use' },
  { value: 'CONSUMPTION', label: 'Consumption' },
  { value: 'PROJECT_USE', label: 'Project Use' },
  { value: 'EMPLOYEE_ISSUE', label: 'Employee Issue' },
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'VARIANT_ASSIGNMENT', label: 'Variant Assignment' },
  { value: 'OTHER', label: 'Other' },
];

/** Label for a service code, falling back to the code itself. */
export function optionLabel(options: { value: string; label: string }[], code: string | null) {
  if (!code) return null;
  return options.find((o) => o.value === code)?.label ?? code;
}
