'use client';

import { cn } from '@/lib/utils';
import type { PermissionAction, PermissionSetResourceDto } from '@/types/roles';

interface PermissionTag {
  key: string;
  label: string;
  /** Pills that are switched on with this one; switching any of them off switches this one off. */
  implies?: string[];
}

interface PermissionSection {
  key: string;
  label: string;
  /** Pill that selects/clears every other pill in the section, when the section has one. */
  umbrellaKey?: string;
  tags: PermissionTag[];
}

export const MARKETING_PERMISSION_SECTIONS: PermissionSection[] = [
  {
    key: 'prospecting',
    label: 'Prospecting',
    umbrellaKey: 'manage_prospects',
    tags: [
      { key: 'manage_prospects', label: 'Manage Prospects' },
      { key: 'view_all_prospects', label: 'View All Prospects' },
      { key: 'edit_all_prospects', label: 'Edit All Prospects' },
      { key: 'delete_all_prospects', label: 'Delete All Prospects' },
      { key: 'manage_all_prospect_interactions', label: 'Manage All Prospect Interactions' },
      { key: 'manage_all_follow_ups', label: 'Manage All Follow Ups' },
      { key: 'create_prospect', label: 'Create Prospect' },
      { key: 'assign_prospects', label: 'Assign Prospects' },
    ],
  },
  {
    key: 'clients',
    label: 'Clients',
    umbrellaKey: 'manage_clients',
    tags: [
      { key: 'manage_clients', label: 'Manage Clients' },
      { key: 'view_all_clients', label: 'View All Clients' },
      { key: 'edit_all_clients', label: 'Edit All Clients' },
      { key: 'delete_all_clients', label: 'Delete All Clients' },
      { key: 'create_client', label: 'Create Client' },
      { key: 'manage_billing', label: 'Manage Billing' },
      { key: 'assign_clients', label: 'Assign Clients' },
    ],
  },
  {
    key: 'campaigns',
    label: 'Campaigns',
    umbrellaKey: 'manage_campaigns',
    tags: [
      { key: 'manage_campaigns', label: 'Manage Campaigns' },
      { key: 'view_campaigns', label: 'View Campaigns' },
    ],
  },
  {
    key: 'transport',
    label: 'Transport',
    tags: [
      { key: 'manage_requests', label: 'Manage Requests', implies: ['view_all_requests'] },
      { key: 'view_all_requests', label: 'View All Requests' },
      { key: 'manage_transport_officers', label: 'Manage Transport Officers' },
      { key: 'view_fleet', label: 'View Fleet' },
      { key: 'manage_fleet', label: 'Manage Fleet', implies: ['view_fleet'] },
    ],
  },
  {
    key: 'crm-configuration',
    label: 'CRM Configuration',
    umbrellaKey: 'manage_crm_configuration',
    tags: [
      { key: 'manage_crm_configuration', label: 'Manage CRM Configuration' },
      { key: 'manage_pipelines', label: 'Manage Pipelines' },
      { key: 'manage_products', label: 'Manage Products' },
      { key: 'manage_decision_makers', label: 'Manage Decision Makers' },
      { key: 'manage_source_types', label: 'Manage Source Types' },
      { key: 'manage_interaction_types', label: 'Manage Interaction Types' },
      { key: 'manage_business_types', label: 'Manage Business Types' },
    ],
  },
];

type PermissionPair = { resource: string; action: string };

const pairs = (resource: string, actions: string[]): PermissionPair[] =>
  actions.map((action) => ({ resource, action }));

const CRUD = ['VIEW', 'CREATE', 'EDIT', 'DELETE'];
const FOLLOW_UP_ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'CANCEL'];

const PROSPECT_OWN_VIEW = pairs('marketing.prospects', ['VIEW']);
const CLIENT_OWN_VIEW = pairs('marketing.clients', ['VIEW']);

/** Pills in a section other than its umbrella. */
const sectionDetailKeys = (sectionKey: string): string[] => {
  const section = MARKETING_PERMISSION_SECTIONS.find((s) => s.key === sectionKey)!;
  return section.tags.map((t) => t.key).filter((k) => k !== section.umbrellaKey);
};

const ALL_TAGS = MARKETING_PERMISSION_SECTIONS.flatMap((section) => section.tags);

const DETAIL_MAPPING: Record<string, PermissionPair[]> = {
  // Prospecting — "create prospect" is the own-records bundle: the creator is
  // assigned the prospect and can view/edit/delete it plus its interactions and follow-ups.
  create_prospect: [
    ...pairs('marketing.prospects', CRUD),
    ...pairs('marketing.prospects.interactions', ['VIEW', 'CREATE']),
    ...pairs('marketing.follow-ups', FOLLOW_UP_ACTIONS),
  ],
  // Every "all" pill also carries the own view permission.
  view_all_prospects: [
    ...PROSPECT_OWN_VIEW,
    ...pairs('marketing.prospects.all', ['VIEW']),
    ...pairs('marketing.prospects.interactions', ['VIEW']),
    ...pairs('marketing.follow-ups', ['VIEW']),
  ],
  edit_all_prospects: [...PROSPECT_OWN_VIEW, ...pairs('marketing.prospects.all', ['EDIT'])],
  delete_all_prospects: [...PROSPECT_OWN_VIEW, ...pairs('marketing.prospects.all', ['DELETE'])],
  manage_all_prospect_interactions: [
    ...PROSPECT_OWN_VIEW,
    ...pairs('marketing.prospects.interactions', ['VIEW']),
    ...pairs('marketing.prospects.interactions.all', ['VIEW', 'CREATE']),
  ],
  manage_all_follow_ups: [
    ...PROSPECT_OWN_VIEW,
    ...pairs('marketing.follow-ups', ['VIEW']),
    ...pairs('marketing.follow-ups.all', FOLLOW_UP_ACTIONS),
  ],

  // Assigning is on top of the own-records view: a user hands on the records they can already see.
  assign_prospects: [...PROSPECT_OWN_VIEW, ...pairs('marketing.prospects', ['ASSIGN'])],

  // Clients — "create client" is the own-records bundle, like "create prospect".
  create_client: pairs('marketing.clients', CRUD),
  view_all_clients: [...CLIENT_OWN_VIEW, ...pairs('marketing.clients.all', ['VIEW'])],
  edit_all_clients: [...CLIENT_OWN_VIEW, ...pairs('marketing.clients.all', ['EDIT'])],
  delete_all_clients: [...CLIENT_OWN_VIEW, ...pairs('marketing.clients.all', ['DELETE'])],
  // Billing sits on top of client visibility: a user bills the clients they can already see.
  manage_billing: [...CLIENT_OWN_VIEW, ...pairs('marketing.clients.billing', ['VIEW', 'CREATE'])],

  assign_clients: [...CLIENT_OWN_VIEW, ...pairs('marketing.clients', ['ASSIGN'])],

  // Transport — each "manage" pill carries the full set for its area.
  manage_requests: [
    ...pairs('marketing.requests', ['VIEW', 'CREATE', 'EDIT', 'CANCEL']),
    ...pairs('marketing.requests.all', ['VIEW', 'APPROVE']),
  ],
  view_all_requests: [
    ...pairs('marketing.requests', ['VIEW']),
    ...pairs('marketing.requests.all', ['VIEW']),
  ],
  manage_transport_officers: pairs('marketing.transport-officers', ['VIEW', 'CREATE', 'EDIT']),
  view_fleet: pairs('marketing.fleet', ['VIEW']),
  manage_fleet: pairs('marketing.fleet', ['VIEW', 'CREATE', 'EDIT', 'DELETE']),

  // Campaigns — "view" is the read-only pill; "manage" is the umbrella below.
  view_campaigns: pairs('marketing.campaigns', ['VIEW']),

  // CRM Configuration
  manage_pipelines: pairs('marketing.pipeline-stages', CRUD),
  manage_products: pairs('marketing.products', CRUD),
  manage_decision_makers: pairs('marketing.decision-makers', CRUD),
  manage_source_types: pairs('marketing.source-types', CRUD),
  manage_interaction_types: pairs('marketing.interaction-media', CRUD),
  manage_business_types: pairs('marketing.business-types', CRUD),
};

const UMBRELLA_EXTRAS: Record<string, PermissionPair[]> = {
  manage_crm_configuration: pairs('marketing.crm-settings', CRUD),
  manage_prospects: [],
  manage_clients: [],
  manage_campaigns: pairs('marketing.campaigns', ['VIEW', 'CREATE', 'CANCEL']),
};

/** Pill key → backend resource/action pairs it grants (umbrellas grant their section's union). */
export const MARKETING_PERMISSION_TAG_MAPPING: Record<string, PermissionPair[]> = {
  ...DETAIL_MAPPING,
  ...Object.fromEntries(
    MARKETING_PERMISSION_SECTIONS.flatMap((section) => {
      const umbrellaKey = section.umbrellaKey;
      if (!umbrellaKey) return [];
      const merged = [
        ...(UMBRELLA_EXTRAS[umbrellaKey] ?? []),
        ...sectionDetailKeys(section.key).flatMap((k) => DETAIL_MAPPING[k] ?? []),
      ];
      const unique = new Map(merged.map((p) => [`${p.resource}:${p.action}`, p]));
      return [[umbrellaKey, [...unique.values()]]];
    }),
  ),
};

/** Lets a marketing admin create roles and assign them; the backend scopes this to marketing. */
const ROLE_MANAGEMENT_PERMISSIONS: PermissionPair[] = [
  ...pairs('permission-sets', ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'ASSIGN']),
  ...pairs('users', ['VIEW']),
];

/** Every marketing permission plus role management — granted by the Marketing Admin tag in HR roles. */
export const MARKETING_ADMIN_PERMISSIONS: PermissionPair[] = [
  ...new Map(
    [
      ...ALL_TAGS.flatMap((tag) => MARKETING_PERMISSION_TAG_MAPPING[tag.key] ?? []),
      ...ROLE_MANAGEMENT_PERMISSIONS,
    ].map((p) => [`${p.resource}:${p.action}`, p] as const),
  ).values(),
];

/** Turns the selected pills into the resource/action DTOs the permission-set API expects. */
export function buildMarketingPermissionResources(
  selectedKeys: string[],
  resourceIdMap: Map<string, string>,
): PermissionSetResourceDto[] {
  const seen = new Set<string>();
  const dtos: PermissionSetResourceDto[] = [];

  for (const key of selectedKeys) {
    for (const { resource, action } of MARKETING_PERMISSION_TAG_MAPPING[key] ?? []) {
      const resourceId = resourceIdMap.get(resource);
      if (!resourceId) continue;
      const id = `${resourceId}:${action}`;
      if (seen.has(id)) continue;
      seen.add(id);
      dtos.push({ resourceId, action: action as PermissionAction });
    }
  }

  return dtos;
}

/** Reverse-maps a set's existing resource:action pairs back to pill keys. */
export function inferMarketingTagsFromResources(
  resources: Array<{ resource: { name: string }; action: string }>,
): string[] {
  const has = new Set(resources.map((r) => `${r.resource.name}:${r.action}`));
  return Object.entries(MARKETING_PERMISSION_TAG_MAPPING)
    .filter(
      ([, perms]) =>
        perms.length > 0 && perms.every(({ resource, action }) => has.has(`${resource}:${action}`)),
    )
    .map(([key]) => key);
}

interface MarketingPermissionSectionsProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function MarketingPermissionSections({ value, onChange }: MarketingPermissionSectionsProps) {
  const selected = new Set(value);

  const toggle = (section: PermissionSection, key: string) => {
    const umbrellaKey = section.umbrellaKey;
    const detailKeys = sectionDetailKeys(section.key);
    const next = new Set(selected);

    if (umbrellaKey && key === umbrellaKey) {
      // Umbrella selects or clears every pill in its section.
      if (next.has(key)) {
        detailKeys.forEach((k) => next.delete(k));
        next.delete(key);
      } else {
        detailKeys.forEach((k) => next.add(k));
        next.add(key);
      }
    } else if (next.has(key)) {
      next.delete(key);
      if (umbrellaKey) next.delete(umbrellaKey);
      // Switching off a pill also switches off any pill that depends on it.
      section.tags.filter((t) => t.implies?.includes(key)).forEach((t) => next.delete(t.key));
    } else {
      next.add(key);
      section.tags.find((t) => t.key === key)?.implies?.forEach((k) => next.add(k));
      // A section with a single detail pill (e.g. View) must not promote itself to Manage.
      if (umbrellaKey && detailKeys.length > 1 && detailKeys.every((k) => next.has(k))) {
        next.add(umbrellaKey);
      }
    }

    onChange(Array.from(next));
  };

  return (
    <div className="flex flex-col gap-6">
      {MARKETING_PERMISSION_SECTIONS.map((section) => (
        <div key={section.key} className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-700">{section.label}</p>
          <div className="flex flex-wrap gap-2">
            {section.tags.map((tag) => (
              <button
                key={tag.key}
                type="button"
                onClick={() => toggle(section, tag.key)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                  selected.has(tag.key)
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700',
                )}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
