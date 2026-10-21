import { useAuthStore } from '@/store/auth.store';
import {
  ACCOUNTING_PAGE_PERMISSIONS,
  ACCOUNTING_PAGE_TABS,
  ACCOUNTING_PERMISSION_PREFIX,
} from '@/lib/accountingAccess';

/** What the current user can reach in Accounting: whole pages, the tabs inside them, and single actions. */
export function useAccountingAccess() {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN';
  const has = (required: readonly string[]) =>
    isAdmin || required.some((permission) => permissions.includes(permission));
  const isAccountant =
    isAdmin ||
    permissions.some((permission) => permission.startsWith(ACCOUNTING_PERMISSION_PREFIX));

  /** Whether the user holds a single permission, for showing or hiding an action. */
  const can = (permission: string) => has([permission]);

  /** The tab keys of a multi-tab page. */
  function tabsOf(page: string): string[] {
    return Object.keys(ACCOUNTING_PAGE_TABS[page] ?? {});
  }

  function canSeeTab(page: string, tab: string): boolean {
    if (!isAccountant) return false;
    const tabs = ACCOUNTING_PAGE_TABS[page];
    if (!tabs) return true;
    const required = tabs[tab];
    return !!required && has(required);
  }

  /** A page shows when at least one of its tabs does. */
  function canSeePage(page: string): boolean {
    if (!isAccountant) return false;
    if (ACCOUNTING_PAGE_TABS[page]) return tabsOf(page).some((tab) => canSeeTab(page, tab));
    const required = ACCOUNTING_PAGE_PERMISSIONS[page];
    return !required || has(required);
  }

  /** The first tab the user can open, to land on when a page is opened without one. */
  function firstTab(page: string): string | undefined {
    return tabsOf(page).find((tab) => canSeeTab(page, tab));
  }

  return { can, canSeePage, canSeeTab, tabsOf, firstTab, isResolving: !user, isAccountant };
}
