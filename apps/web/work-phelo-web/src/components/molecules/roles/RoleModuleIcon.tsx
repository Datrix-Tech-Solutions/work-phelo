import { ShieldCheck } from 'lucide-react';
import { ModuleIcons, MODULE_COLORS } from '@/components/atoms/icons';
import type { PermissionSet } from '@/types/roles';

/**
 * The module a role mostly belongs to: whichever has the most permissions on it.
 * AUTH permissions (role/user management) are ignored so they don't outweigh a
 * role's business module. Returns null when nothing else is left.
 */
export function getRolePrimaryModule(set: Pick<PermissionSet, 'resources'>): string | null {
  const counts = new Map<string, number>();
  for (const { resource } of set.resources) {
    const key = resource.module.toLowerCase();
    if (key === 'auth') continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let primary: string | null = null;
  let max = 0;
  for (const [key, count] of counts) {
    if (count > max) {
      primary = key;
      max = count;
    }
  }
  return primary;
}

export function RoleModuleIcon({ set }: { set: Pick<PermissionSet, 'resources'> }) {
  const moduleKey = getRolePrimaryModule(set);
  const Icon = moduleKey
    ? (ModuleIcons as Record<string, React.ElementType>)[moduleKey]
    : undefined;
  const color = moduleKey ? MODULE_COLORS[moduleKey] : undefined;

  // No module to show (e.g. AUTH-only role) — keep the original shield in the brand color.
  if (!moduleKey || !Icon || !color) {
    return (
      <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
        <ShieldCheck className="w-4 h-4 text-brand" />
      </div>
    );
  }

  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: `color-mix(in oklch, ${color} 10%, transparent)`, color }}
    >
      <Icon className="w-4 h-4" />
    </div>
  );
}
