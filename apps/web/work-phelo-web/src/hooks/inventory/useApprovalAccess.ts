import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import type { StockMovementType } from '@/hooks/inventory/useStockMovements';

/**
 * Approving takes the EDIT permission of the thing being approved, which keeps it apart from the
 * CREATE permission needed to make it. Company admins hold every permission.
 */
const APPROVE_PERMISSION: Record<StockMovementType | 'PURCHASE_ORDER', string> = {
  PURCHASE_ORDER: 'operations.inventory.stock-in:EDIT',
  STOCK_IN: 'operations.inventory.stock-in:EDIT',
  STOCK_OUT: 'operations.inventory.stock-out:EDIT',
  TRANSFER: 'operations.inventory.transfers:EDIT',
  ADJUSTMENT: 'operations.inventory.adjustments:EDIT',
};

export function useCanApprove(kind: StockMovementType | 'PURCHASE_ORDER') {
  return useAnyPermissionRules([APPROVE_PERMISSION[kind]]);
}
