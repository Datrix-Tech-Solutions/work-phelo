/**
 * Which permissions make each Marketing page (and each tab of a multi-tab page) reachable, mirroring
 * what the backend routes behind them demand. A user holding none of a page's permissions is not
 * shown it; a page whose tabs are all out of reach is not shown at all.
 */

/**
 * Pages that take a permission. Anything not listed (dashboard, appointments, transport requests) is
 * open to everyone - each person sees their own, and approvers see more.
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
