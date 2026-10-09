/**
 * Which permissions make each Marketing page (and each tab of a multi-tab page) reachable, mirroring
 * what the backend routes behind them demand. A user holding none of a page's permissions is not
 * shown it; a page whose tabs are all out of reach is not shown at all.
 */

/**
 * A marketer is a module user: someone holding at least one marketing permission (or an admin).
 * Everyone else in the company can only use the pages in MARKETING_OPEN_PAGES.
 */
export const MARKETING_PERMISSION_PREFIX = 'marketing.';

/** Pages open to every employee, marketer or not: each person raises and sees their own, approvers see more. */
export const MARKETING_OPEN_PAGES: readonly string[] = ['requests'];

/**
 * Pages that take a permission. A marketer sees anything not listed here (dashboard, appointments,
 * transport requests); a non-marketer only sees MARKETING_OPEN_PAGES.
 */
export const MARKETING_PAGE_TABS: Record<string, Record<string, string[]>> = {
  campaigns: { main: ['marketing.campaigns:VIEW'] },
  'fleet-management': { main: ['marketing.fleet:VIEW'] },
  'transport-officers': {
    details: ['marketing.transport-officers:VIEW'],
    location: ['marketing.transport-officers:VIEW'],
  },
  settings: {
    'sales-pipeline': ['marketing.crm-settings:VIEW', 'marketing.pipeline-stages:VIEW'],
    product: ['marketing.crm-settings:VIEW', 'marketing.products:VIEW'],
    'decision-maker': ['marketing.crm-settings:VIEW', 'marketing.decision-makers:VIEW'],
    'source-type': ['marketing.crm-settings:VIEW', 'marketing.source-types:VIEW'],
    'interaction-medium': ['marketing.crm-settings:VIEW', 'marketing.interaction-media:VIEW'],
    domains: ['marketing.domains:VIEW'],
    'sms-senders': ['marketing.sms-sender-identities:VIEW', 'marketing.sms-wallet:VIEW'],
    'prospect-business-type': ['marketing.crm-settings:VIEW', 'marketing.business-types:VIEW'],
  },
  'user-management': {
    'roles-permissions': ['permission-sets:VIEW'],
    'module-users': ['permission-sets:VIEW'],
  },
};

/**
 * Clients and Prospects are open to anyone with records assigned to them, so beyond the permissions
 * below they also show for a user who has at least one assigned.
 */
export const MARKETING_RECORD_PAGES = {
  clients: { main: ['marketing.clients:VIEW', 'marketing.clients.all:VIEW'] },
  prospects: {
    all: ['marketing.prospects:VIEW', 'marketing.prospects.all:VIEW'],
    'upcoming-reminders': ['marketing.follow-ups:VIEW', 'marketing.follow-ups.all:VIEW'],
  },
} as const;
