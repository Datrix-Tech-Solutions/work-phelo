'use client';

import {
  PermissionPillSections,
  buildPermissionResources,
  inferTagsFromResources,
  pairs,
  type PermissionPair,
  type PermissionSection,
} from '@/components/molecules/roles/PermissionPillSections';
import type { PermissionSetResourceDto } from '@/types/roles';

/** Each area has a read-only pill; the others imply it, since an action is no use on a page that cannot open. */
export const ACCOUNTING_PERMISSION_SECTIONS: PermissionSection[] = [
  {
    key: 'cash-and-bank',
    label: 'Cash and Bank',
    group: 'Accounts',
    tags: [
      { key: 'view_cash_and_bank', label: 'View Cash and Bank' },
      {
        key: 'manage_cash_and_bank',
        label: 'Manage Cash and Bank',
        implies: ['view_cash_and_bank'],
      },
      {
        key: 'deactivate_cash_accounts',
        label: 'Deactivate Cash Accounts',
        implies: ['view_cash_and_bank'],
      },
    ],
  },
  {
    key: 'chart-of-accounts',
    label: 'Chart of Accounts',
    group: 'Accounts',
    tags: [
      { key: 'view_chart_of_accounts', label: 'View Chart of Accounts' },
      {
        key: 'manage_chart_of_accounts',
        label: 'Manage Chart of Accounts',
        implies: ['view_chart_of_accounts'],
      },
    ],
  },
  {
    key: 'transactions',
    label: 'Transactions',
    group: 'Entries',
    tags: [
      { key: 'view_transactions', label: 'View Transactions' },
      { key: 'create_transactions', label: 'Create Transactions', implies: ['view_transactions'] },
      {
        key: 'post_transactions',
        label: 'Approve Transactions',
        implies: ['view_transactions'],
      },
      { key: 'void_transactions', label: 'Void Transactions', implies: ['view_transactions'] },
      {
        key: 'reverse_transactions',
        label: 'Reverse Transactions',
        implies: ['view_transactions'],
      },
    ],
  },
  {
    key: 'journal-entries',
    label: 'Journal Entries',
    group: 'Entries',
    tags: [
      { key: 'view_journal_entries', label: 'View Journal Entries' },
      {
        key: 'create_journal_entries',
        label: 'Create Entries',
        implies: ['view_journal_entries'],
      },
      {
        key: 'post_journal_entries',
        label: 'Approve Entries',
        implies: ['view_journal_entries'],
      },
      { key: 'void_journal_entries', label: 'Void Entries', implies: ['view_journal_entries'] },
      {
        key: 'reverse_journal_entries',
        label: 'Reverse Entries',
        implies: ['view_journal_entries'],
      },
    ],
  },
  {
    key: 'archive',
    label: 'Archive',
    group: 'Entries',
    tags: [
      { key: 'view_archive', label: 'View Archive' },
      { key: 'manage_archive', label: 'Manage Archive', implies: ['view_archive'] },
    ],
  },
  {
    key: 'entities',
    label: 'Entities',
    group: 'Data and Planning',
    tags: [
      { key: 'view_entities', label: 'View Entities' },
      { key: 'manage_entities', label: 'Manage Entities', implies: ['view_entities'] },
    ],
  },
  {
    key: 'cost-centres',
    label: 'Cost Centres',
    group: 'Data and Planning',
    tags: [
      { key: 'view_cost_centres', label: 'View Cost Centres' },
      { key: 'manage_cost_centres', label: 'Manage Cost Centres', implies: ['view_cost_centres'] },
    ],
  },
  {
    key: 'budgets',
    label: 'Budgets',
    group: 'Data and Planning',
    tags: [
      { key: 'view_budgets', label: 'View Budgets' },
      { key: 'manage_budgets', label: 'Manage Budgets', implies: ['view_budgets'] },
    ],
  },
  {
    key: 'financial-reports',
    label: 'Financial Reports',
    group: 'Reports',
    tags: [{ key: 'view_financial_reports', label: 'View Financial Reports' }],
  },
  {
    key: 'transaction-settings',
    label: 'Transaction Settings',
    group: 'Settings',
    tags: [
      { key: 'view_transaction_settings', label: 'View Transaction Settings' },
      {
        key: 'manage_transaction_settings',
        label: 'Manage Transaction Settings',
        implies: ['view_transaction_settings'],
      },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    group: 'Settings',
    tags: [
      { key: 'view_accounting_settings', label: 'View Accounting Settings' },
      {
        key: 'manage_accounting_settings',
        label: 'Manage Accounting Settings',
        implies: ['view_accounting_settings'],
      },
    ],
  },
];

const CRUD = ['VIEW', 'CREATE', 'EDIT', 'DELETE'];
const CRUD_DEACTIVATE = ['VIEW', 'CREATE', 'EDIT', 'DEACTIVATE', 'DELETE'];

/**
 * Pill key → backend resource/action pairs it grants. The action names follow the backend: APPROVE
 * posts, CANCEL voids, DELETE reverses (journals, transactions) and EDIT on the archive restores.
 */
export const ACCOUNTING_PERMISSION_TAG_MAPPING: Record<string, PermissionPair[]> = {
  view_transactions: pairs('accounting.transactions', ['VIEW']),
  create_transactions: pairs('accounting.transactions', ['VIEW', 'CREATE']),
  post_transactions: pairs('accounting.transactions', ['VIEW', 'APPROVE']),
  void_transactions: pairs('accounting.transactions', ['VIEW', 'CANCEL']),
  reverse_transactions: pairs('accounting.transactions', ['VIEW', 'DELETE']),

  view_journal_entries: pairs('accounting.journals', ['VIEW']),
  create_journal_entries: pairs('accounting.journals', ['VIEW', 'CREATE', 'EDIT']),
  post_journal_entries: pairs('accounting.journals', ['VIEW', 'APPROVE']),
  void_journal_entries: pairs('accounting.journals', ['VIEW', 'CANCEL']),
  reverse_journal_entries: pairs('accounting.journals', ['VIEW', 'DELETE']),

  view_chart_of_accounts: [
    ...pairs('accounting.accounts', ['VIEW']),
    ...pairs('accounting.account-classifications', ['VIEW']),
    ...pairs('accounting.account-groups', ['VIEW']),
  ],
  manage_chart_of_accounts: [
    ...pairs('accounting.accounts', CRUD),
    ...pairs('accounting.account-classifications', CRUD_DEACTIVATE),
    ...pairs('accounting.account-groups', CRUD_DEACTIVATE),
  ],

  view_cash_and_bank: [
    ...pairs('accounting.cash-accounts', ['VIEW']),
    ...pairs('accounting.cashbook', ['VIEW']),
    ...pairs('accounting.bank-reconciliations', ['VIEW']),
  ],
  // Managing covers making contra transactions and reconciling; deactivating an account is separate.
  manage_cash_and_bank: [
    ...pairs('accounting.cash-accounts', ['VIEW', 'EDIT']),
    ...pairs('accounting.cashbook', ['VIEW']),
    ...pairs('accounting.bank-reconciliations', ['VIEW', 'EDIT']),
  ],
  deactivate_cash_accounts: pairs('accounting.cash-accounts', ['VIEW', 'DEACTIVATE']),

  view_archive: pairs('accounting.archive', ['VIEW']),
  manage_archive: pairs('accounting.archive', ['VIEW', 'EDIT', 'DELETE']),

  view_entities: pairs('accounting.entities', ['VIEW']),
  manage_entities: pairs('accounting.entities', CRUD_DEACTIVATE),

  view_cost_centres: pairs('accounting.cost-centres', ['VIEW']),
  manage_cost_centres: pairs('accounting.cost-centres', ['VIEW', 'CREATE', 'EDIT', 'DEACTIVATE']),

  view_financial_reports: pairs('accounting.ledger', ['VIEW']),

  view_budgets: pairs('accounting.budgets', ['VIEW']),
  manage_budgets: pairs('accounting.budgets', [...CRUD, 'APPROVE']),

  view_transaction_settings: pairs('accounting.transaction-settings', ['VIEW']),
  manage_transaction_settings: pairs('accounting.transaction-settings', CRUD),

  view_accounting_settings: pairs('accounting.settings', ['VIEW']),
  manage_accounting_settings: pairs('accounting.settings', ['VIEW', 'EDIT']),
};

/** Turns the selected pills into the resource/action DTOs the permission-set API expects. */
export function buildAccountingPermissionResources(
  selectedKeys: string[],
  resourceIdMap: Map<string, string>,
): PermissionSetResourceDto[] {
  return buildPermissionResources(ACCOUNTING_PERMISSION_TAG_MAPPING, selectedKeys, resourceIdMap);
}

/** Reverse-maps a set's existing resource:action pairs back to pill keys. */
export function inferAccountingTagsFromResources(
  resources: Array<{ resource: { name: string }; action: string }>,
): string[] {
  return inferTagsFromResources(ACCOUNTING_PERMISSION_TAG_MAPPING, resources);
}

interface AccountingPermissionSectionsProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function AccountingPermissionSections({
  value,
  onChange,
}: AccountingPermissionSectionsProps) {
  return (
    <PermissionPillSections
      sections={ACCOUNTING_PERMISSION_SECTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
