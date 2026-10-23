import { isModuleSet, useModuleUsers, type ModuleUser } from '@/hooks/useModuleUsers';
import type { PermissionSet } from '@/types/roles';

export type MarketingModuleUser = ModuleUser;

/** A role belongs to marketing when it carries at least one marketing resource. */
export function isMarketingSet(set: PermissionSet): boolean {
  return isModuleSet(set, 'MARKETING');
}

/** Users who hold at least one marketing permission, through a role or a direct grant. */
export function useMarketingModuleUsers() {
  return useModuleUsers('MARKETING');
}
