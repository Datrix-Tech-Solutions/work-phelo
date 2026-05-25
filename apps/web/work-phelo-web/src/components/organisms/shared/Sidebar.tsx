'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
  // children turns this item into a collapsible dropdown section
  children?: NavItem[];
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

/* ──────────────────────── Child Item ───────────────────────── */

function SidebarChildItem({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isCurrent = pathname === item.href || pathname.startsWith(item.href + '/');
  const isDeactivated = item.active === false;

  const baseRow = 'flex items-center px-3 py-2 rounded-input transition-colors w-full text-sm';

  if (isDeactivated) {
    return (
      <div className={cn(baseRow, 'cursor-not-allowed text-gray-300')}>
        <span className="truncate">{item.label}</span>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        baseRow,
        isCurrent
          ? 'bg-[#EEF1F8] text-brand font-semibold'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
      )}
    >
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/* ─────────────────────── Dropdown Item ─────────────────────── */

function SidebarDropdownItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();

  const isAnyChildActive =
    item.children?.some(
      (child) => pathname === child.href || pathname.startsWith(child.href + '/'),
    ) ?? false;

  const [open, setOpen] = useState(false);

  // A child route being active always forces the section open
  const isOpen = open || isAnyChildActive;

  const isDeactivated = item.active === false;

  const baseRow = cn(
    'relative flex items-center gap-3 rounded-input transition-colors w-full',
    collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
  );

  return (
    <div className="relative group/tip px-2">
      {/* Highlight bar when a child is active */}
      {isAnyChildActive && !isDeactivated && !collapsed && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.75 bg-brand rounded-r-full" />
      )}

      <button
        type="button"
        disabled={isDeactivated}
        onClick={() => {
          if (!collapsed) setOpen((v) => !v || isAnyChildActive);
        }}
        className={cn(
          baseRow,
          isDeactivated
            ? 'cursor-not-allowed text-gray-300'
            : isAnyChildActive
              ? 'bg-[#EEF1F8] text-brand font-semibold'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
        )}
      >
        <span
          className={cn(
            'shrink-0 flex items-center justify-center',
            isDeactivated ? 'text-gray-300' : isAnyChildActive ? 'text-brand' : 'text-gray-400',
          )}
        >
          {item.icon}
        </span>

        {!collapsed && (
          <>
            <span className="text-sm truncate flex-1 text-left">{item.label}</span>
            <ChevronDown
              className={cn(
                'w-4 h-4 shrink-0 transition-transform duration-200',
                isOpen && 'rotate-180',
              )}
            />
          </>
        )}
      </button>

      {/* Flyout menu when collapsed */}
      {collapsed && (
        <div
          className={cn(
            'absolute left-full top-0 ml-2 z-50',
            'opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150',
            'pointer-events-none group-hover/tip:pointer-events-auto',
          )}
        >
          {/* Invisible bridge to prevent hover gap closing the flyout */}
          <div className="absolute right-full top-0 bottom-0 w-2" />
          <div className="bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 min-w-[160px]">
            <p className="px-3 py-1.5 text-[10px] font-semibold tracking-widest text-gray-400 uppercase select-none">
              {item.label}
            </p>
            {item.children
              ?.filter((child) => child.enabled !== false)
              .map((child) => (
                <SidebarChildItem key={child.key} item={child} />
              ))}
          </div>
        </div>
      )}

      {/* Children list — only in expanded sidebar */}
      {isOpen && !collapsed && (
        <div className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l border-gray-100 pl-2">
          {item.children
            ?.filter((child) => child.enabled !== false)
            .map((child) => (
              <SidebarChildItem key={child.key} item={child} />
            ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Sidebar ─────────────────────────── */

export function Sidebar({ groups, collapsed = false }: SidebarProps) {
  const [isHovering, setIsHovering] = useState(false);
  const effectiveCollapsed = collapsed && !isHovering;

  return (
    <aside
      onMouseEnter={() => collapsed && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={cn(
        'bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-hidden',
        // Mobile: absolute drawer that slides over content (below the top nav)
        'absolute inset-y-0 left-0 z-40 w-64 transition-transform duration-200',
        // Desktop: static in flex flow with width animation
        'md:relative md:z-auto md:translate-x-0 md:transition-[width] md:duration-200',
        effectiveCollapsed ? '-translate-x-full md:w-14' : 'translate-x-0 md:w-56',
      )}
    >
      <nav className="flex-1 overflow-y-auto py-3 flex flex-col">
        {groups.map((group) => {
          const visibleItems = group.items.filter((item) => item.enabled !== false);
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="mb-1">
              {/* Group label / divider */}
              {effectiveCollapsed ? (
                <div className="mx-3 my-2 h-px bg-gray-200" />
              ) : (
                <p className="px-5 pt-5 pb-1.5 text-[10px] font-semibold tracking-widest text-gray-400 uppercase select-none">
                  {group.label}
                </p>
              )}

              {/* Nav items */}
              <div className="flex flex-col gap-0.5">
                {visibleItems.map((item) =>
                  item.children?.length ? (
                    <SidebarDropdownItem
                      key={item.key}
                      item={item}
                      collapsed={effectiveCollapsed}
                    />
                  ) : (
                    <SidebarItem key={item.key} item={item} collapsed={effectiveCollapsed} />
                  ),
                )}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
