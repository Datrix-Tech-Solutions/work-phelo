'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import type { InventoryWarehouse } from '@/hooks/inventory/useInventoryWarehouses';

interface WarehouseManagePanelProps {
  warehouse: InventoryWarehouse | null;
  onClose: () => void;
}

/** Side panel for managing a warehouse. Empty for now. */
export function WarehouseManagePanel({ warehouse, onClose }: WarehouseManagePanelProps) {
  return (
    <SidePanel
      isOpen={!!warehouse}
      onClose={onClose}
      title="Manage Warehouse"
      description={warehouse?.name}
    >
      <div />
    </SidePanel>
  );
}
