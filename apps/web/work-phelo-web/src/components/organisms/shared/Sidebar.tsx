'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/* ─────────────────────────── Types ─────────────────────────── */

export interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  // enabled false cannot be seen at all used by company admin
  enabled?: boolean;
  // active false make it inactive used by superadmin for feature control //
  active?: boolean;
  // exact true means only highlight on exact path match (use for index/dashboard routes)
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  groups: NavGroup[];
  collapsed?: boolean;
}

/* ─────────────────────────── Item ─────────────────────────── */

function SidebarItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const isCurrent = pathname === item.href || (!item.exact && pathname.startsWith(item.href + '/'));
  const isDeactivated = item.active === false;

  const iconEl = (
    <span
      className={cn(
        'shrink-0 flex items-center justify-center',
        isDeactivated ? 'text-gray-300' : isCurrent ? 'text-brand' : 'text-gray-400',
      )}
    >
      {item.icon}
    </span>
  );

  const inner = (
    <>
      {iconEl}
      {!collapsed && <span className="text-sm truncate">{item.label}</span>}
    </>
  );

  const baseRow = cn(
    'relative flex items-center gap-3 rounded-input transition-colors w-full',
    collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
  );

  return (
    /* tooltip wrapper */
    <div className="relative group/tip px-2">
      {/* Active left-bar accent */}
      {isCurrent && !isDeactivated && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.75 bg-brand rounded-r-full" />
      )}

      {isDeactivated ? (
        /* Deactivated — visible but non-clickable, grayed out */
        <div
          title={collapsed ? item.label : undefined}
          className={cn(baseRow, 'cursor-not-allowed text-gray-300')}
        >
          {inner}
        </div>
      ) : (
        /* Normal / current */
        <Link
          href={item.href}
          className={cn(
            baseRow,
            isCurrent
              ? 'bg-[#EEF1F8] text-brand font-semibold'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
          )}
        >
          {inner}
        </Link>
      )}

      {/* Tooltip — only when collapsed */}
      {collapsed && (
        <div
          className={cn(
            'pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50',
            'px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap',
            'opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150',
          )}
        >
          {item.label}
          {isDeactivated && <span className="ml-1.5 text-gray-400 text-[10px]">(inactive)</span>}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Sidebar ─────────────────────────── */

export function Sidebar({ groups, collapsed = false }: SidebarProps) {
  return (
    <aside
      className={cn(
        'h-full bg-white border-r border-gray-200 flex flex-col shrink-0 transition-[width] duration-200 overflow-hidden',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      <nav className="flex-1 overflow-y-auto py-3 flex flex-col">
        {groups.map((group) => {
          const visibleItems = group.items.filter((item) => item.enabled !== false);
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="mb-1">
              {/* Group label / divider */}
              {collapsed ? (
                <div className="mx-3 my-2 h-px bg-gray-200" />
              ) : (
                <p className="px-5 pt-5 pb-1.5 text-[10px] font-semibold tracking-widest text-gray-400 uppercase select-none">
                  {group.label}
                </p>
              )}

              {/* Nav items */}
              <div className="flex flex-col gap-0.5">
                {visibleItems.map((item) => (
                  <SidebarItem key={item.key} item={item} collapsed={collapsed} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
