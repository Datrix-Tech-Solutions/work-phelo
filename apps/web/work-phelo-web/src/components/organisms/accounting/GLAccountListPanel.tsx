'use client';

import { useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { TypeChip } from '@/components/atoms/TypeChip';
import { DataTable, type Column, type SortState } from '@/components/organisms/shared/DataTable';
import { CATEGORIES } from '@/components/organisms/accounting/ChartOfAccountsTree';
import { GL_ACCOUNT_CATEGORY_CHIP_COLOR } from '@/lib/accounting/glAccountCategory';
import { formatAccountBalance } from '@/lib/accounting/glAccountBalance';
import type { AccountGroup, GLAccount } from '@/types/accounting';

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label])) as Record<
  GLAccount['category'],
  string
>;

const PAGE_SIZE = 10;

interface GLAccountListPanelProps {
  title: string;
  accounts: GLAccount[];
  isLoading?: boolean;
  onSelectAccount: (account: GLAccount) => void;

  balanceByAccountId?: Map<string, number>;
  baseCurrency?: string;
  groups?: AccountGroup[];
  onEdit?: () => void;
  editLabel?: string;
  /** Creates a new account scoped to whatever's currently selected (a type, classification or
   *  parent account) — hidden for the "all accounts" scope, where there's nothing to scope to. */
  onCreateAccount?: () => void;
}

export function GLAccountListPanel({
  title,
  accounts,
  isLoading = false,
  onSelectAccount,
  balanceByAccountId,
  baseCurrency = '',
  groups = [],
  onEdit,
  editLabel,
  onCreateAccount,
}: GLAccountListPanelProps) {
  const [page, setPage] = useState(1);
  const [sortState, setSortState] = useState<SortState | undefined>();

  const handleSort = (key: string) => {
    setSortState((prev) =>
      prev?.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
    setPage(1);
  };

  const sortedAccounts = useMemo(() => {
    if (!sortState) return accounts;
    const direction = sortState.direction === 'asc' ? 1 : -1;
    const sorted = [...accounts];
    sorted.sort((a, b) => {
      if (sortState.key === 'category') {
        return CATEGORY_LABELS[a.category].localeCompare(CATEGORY_LABELS[b.category]) * direction;
      }
      if (sortState.key === 'balance') {
        const balanceA = balanceByAccountId?.get(a.id) ?? 0;
        const balanceB = balanceByAccountId?.get(b.id) ?? 0;
        return (balanceA - balanceB) * direction;
      }
      return 0;
    });
    return sorted;
  }, [accounts, sortState, balanceByAccountId]);

  const totalPages = Math.max(1, Math.ceil(sortedAccounts.length / PAGE_SIZE));
  const paged = sortedAccounts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const classificationByGroupId = useMemo(() => {
    const map = new Map<string, AccountGroup['classification']>();
    for (const group of groups) map.set(group.id, group.classification);
    return map;
  }, [groups]);

  const columns = useMemo<Column<GLAccount>[]>(
    () => [
      {
        key: 'code',
        label: 'Code',
        width: '70px',
        render: (row) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 font-mono text-xs text-gray-500">
            {row.code}
          </span>
        ),
      },
      {
        key: 'name',
        label: 'Name',
        width: 'minmax(120px, 1fr)',
        render: (row) => <span className="font-bold text-gray-900">{row.name}</span>,
      },
      {
        key: 'category',
        label: 'Type',
        width: '80px',
        sortable: true,
        render: (row) => (
          <TypeChip
            label={CATEGORY_LABELS[row.category]}
            color={GL_ACCOUNT_CATEGORY_CHIP_COLOR[row.category]}
          />
        ),
      },
      {
        key: 'classification',
        label: 'Classification',
        width: 'minmax(120px, 1fr)',
        render: (row) => {
          const classification =
            (row.classification?.id ? row.classification : undefined) ??
            (row.accountGroupId ? classificationByGroupId.get(row.accountGroupId) : undefined);
          return (
            <span className="font-semibold text-gray-500">
              {classification ? `${classification.code} — ${classification.name}` : 'Unclassified'}
            </span>
          );
        },
      },
      {
        key: 'group',
        label: 'Parent Account',
        width: 'minmax(120px, 1fr)',
        render: (row) => (
          <span className="font-semibold text-gray-500">
            {row.accountGroup ? `${row.accountGroup.code} — ${row.accountGroup.name}` : '—'}
          </span>
        ),
      },
      {
        key: 'balance',
        label: 'Balance',
        width: '120px',
        className: 'text-right',
        sortable: true,
        render: (row) => (
          <span className="block text-right font-bold text-gray-700">
            {formatAccountBalance(balanceByAccountId?.get(row.id), baseCurrency)}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: '70px',
        render: (row) => (
          <Badge label={row.status} variant={row.status === 'ACTIVE' ? 'success' : 'neutral'} />
        ),
      },
    ],
    [balanceByAccountId, baseCurrency, classificationByGroupId],
  );

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">
            {accounts.length} account{accounts.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onCreateAccount && (
            <Button
              variant="outline"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={onCreateAccount}
            >
              Create Account
            </Button>
          )}
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              icon={<Pencil className="h-3.5 w-3.5" />}
              onClick={onEdit}
            >
              {editLabel ? `Edit ${editLabel}` : 'Edit'}
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        emptyMessage="No accounts in this scope"
        onRowClick={onSelectAccount}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
        sortState={sortState}
        onSort={handleSort}
      />
    </div>
  );
}
