import { useModuleUsers, type ModuleUser } from '@/hooks/useModuleUsers';

export type InventoryModuleUser = ModuleUser;

/**
 * Permission module the inventory resources will be registered under. No inventory permissions
 * exist yet, so this returns no users until they do.
 */
const INVENTORY_PERMISSION_MODULE = 'INVENTORY';

/** Users who hold at least one inventory permission, through a role or a direct grant. */
export function useInventoryModuleUsers() {
  return useModuleUsers(INVENTORY_PERMISSION_MODULE);
}
