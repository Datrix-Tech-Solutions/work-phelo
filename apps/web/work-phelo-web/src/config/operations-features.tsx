import { Boxes, Handshake } from 'lucide-react';
import type { NavGroup } from '@/components/organisms/shared/Sidebar';
import { DEFAULT_MODULES } from '@/lib/ModuleDefaults';
import { REINSURANCE_NAV_GROUPS } from '@/config/reinsurance-nav';
import { INVENTORY_NAV_GROUPS } from '@/config/inventory-nav';

export interface OperationsFeature {
  key: string;
  /** Display name, taken from the superadmin module configuration. */
  label: string;
  /** Route segment under /[tenantSlug]/operations. */
  segment: string;
  /** Short name and icon for the module links in the HR sidebar and rail. */
  navLabel: string;
  navIcon: React.ReactNode;
  navGroups: NavGroup[];
}

const NAV_GROUPS: Record<string, NavGroup[]> = {
  reinsurance: REINSURANCE_NAV_GROUPS,
  inventory: INVENTORY_NAV_GROUPS,
};

const NAV_LINKS: Record<string, { label: string; icon: React.ReactNode }> = {
  reinsurance: { label: 'Reinsurance', icon: <Handshake className="w-5 h-5" /> },
  inventory: { label: 'Inventory', icon: <Boxes className="w-5 h-5" /> },
};

const OPERATIONS_OPTIONS = DEFAULT_MODULES.find((m) => m.key === 'operations')?.options ?? [];

/** Every operations feature a tenant can be switched to. Add new ones here and in ModuleDefaults. */
export const OPERATIONS_FEATURES: OperationsFeature[] = OPERATIONS_OPTIONS.filter(
  (o) => NAV_GROUPS[o.key],
).map((o) => ({
  key: o.key,
  label: o.label,
  segment: o.key,
  navLabel: NAV_LINKS[o.key]?.label ?? o.label,
  navIcon: NAV_LINKS[o.key]?.icon,
  navGroups: NAV_GROUPS[o.key],
}));

/**
 * The operations feature the superadmin selected for this tenant. Only one can be on at a time,
 * so the first enabled one wins. Returns null when none is enabled.
 */
export function getActiveOperationsFeature(
  featureConfig?: Record<string, Record<string, boolean>>,
): OperationsFeature | null {
  const enabled = featureConfig?.operations ?? {};
  return OPERATIONS_FEATURES.find((f) => enabled[f.key]) ?? null;
}
