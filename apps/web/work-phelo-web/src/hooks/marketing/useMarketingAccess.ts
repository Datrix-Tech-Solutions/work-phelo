import { useAuthStore } from '@/store/auth.store';
import { useClients } from '@/hooks/marketing/useClients';
import { useProspects } from '@/hooks/marketing/useProspects';
import { MARKETING_PAGE_TABS, MARKETING_RECORD_PAGES } from '@/lib/marketingAccess';

type RecordPage = keyof typeof MARKETING_RECORD_PAGES;

/** What the current user can reach in Marketing: whole pages, and the tabs inside them. */
export function useMarketingAccess() {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN';
  const has = (required: readonly string[]) =>
    isAdmin || required.some((permission) => permissions.includes(permission));

  // Being assigned a client or prospect is access enough to its page. Only asked when the user holds
  // none of the permissions, and the list is already limited to their own records.
  const needsClientCheck = !!user && !has(MARKETING_RECORD_PAGES.clients.main);
  const needsProspectCheck = !!user && !has(MARKETING_RECORD_PAGES.prospects.all);
  const ownClients = useClients({ limit: 1 }, needsClientCheck);
  const ownProspects = useProspects({ limit: 1 }, needsProspectCheck);
  const hasOwnClients = (ownClients.data?.meta.total ?? 0) > 0;
  const hasOwnProspects = (ownProspects.data?.meta.total ?? 0) > 0;

  function canSeeTab(page: string, tab: string): boolean {
    if (page === 'clients') return has(MARKETING_RECORD_PAGES.clients.main) || hasOwnClients;
    if (page === 'prospects') {
      const required = MARKETING_RECORD_PAGES.prospects[tab as 'all' | 'upcoming-reminders'];
      return (!!required && has(required)) || hasOwnProspects;
    }
    const tabs = MARKETING_PAGE_TABS[page];
    if (!tabs) return true;
    const required = tabs[tab];
    return !!required && has(required);
  }

  /** The tab keys of a multi-tab page. */
  function tabsOf(page: string): string[] {
    if (page === 'clients') return ['main'];
    if (page === 'prospects') return Object.keys(MARKETING_RECORD_PAGES.prospects);
    return Object.keys(MARKETING_PAGE_TABS[page] ?? { main: [] });
  }

  /** A page shows when at least one of its tabs does. */
  function canSeePage(page: string): boolean {
    if (page !== 'clients' && page !== 'prospects' && !MARKETING_PAGE_TABS[page]) return true;
    return tabsOf(page).some((tab) => canSeeTab(page, tab));
  }

  /** The first tab the user can open, to land on when a page is opened without one. */
  function firstTab(page: string): string | undefined {
    return tabsOf(page).find((tab) => canSeeTab(page, tab));
  }

  const isResolving =
    !user ||
    (needsClientCheck && ownClients.isLoading) ||
    (needsProspectCheck && ownProspects.isLoading);

  return { canSeePage, canSeeTab, tabsOf, firstTab, isResolving };
}

export type { RecordPage };
