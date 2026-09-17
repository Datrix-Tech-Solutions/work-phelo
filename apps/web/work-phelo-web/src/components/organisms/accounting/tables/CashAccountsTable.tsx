'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import {
  AccountingCashAccount,
  AccountingCashAccountKind,
  GLAccount,
} from '@/types/accounting';
import { useAccountGroups, useCashAccounts, useGLAccounts, useUpdateCashAccount } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { AddLeafAccountPanel } from '@/components/organisms/accounting/panels/AddLeafAccountPanel';
import { EditCashAccountPanel } from '@/components/organisms/accounting/panels/EditCashAccountPanel';
import { CompleteCashAccountSetupPanel } from '@/components/organisms/accounting/panels/CompleteCashAccountSetupPanel';

const PAGE_SIZE = 10;

const KIND_LABEL: Record<AccountingCashAccountKind, string> = {
  BANK: 'Bank',
  CASH: 'Cash',
  MOBILE_MONEY: 'Mobile Money',
  OTHER: 'Other',
};

/** A row is either a fully set-up Cash Account, or a leaf GL account already created
 *  under Chart of Accounts > Cash and Bank that's still waiting to be completed —
 *  it's visible here as soon as it exists, but can't be used for payments until then. */
type Row =
  | { id: string; status: 'complete'; cashAccount: AccountingCashAccount }
  | { id: string; status: 'incomplete'; glAccount: GLAccount };

export function CashAccountsTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deactivateTarget, setDeactivateTarget] = useState<AccountingCashAccount | null>(null);
  const [editTarget, setEditTarget] = useState<AccountingCashAccount | null>(null);
  const [setupTarget, setSetupTarget] = useState<GLAccount | null>(null);
  const [addPanelOpen, setAddPanelOpen] = useState(false);

  const { data: cashAccounts = [], isLoading: isLoadingCashAccounts } = useCashAccounts();
  const { data: glAccounts = [], isLoading: isLoadingGLAccounts } = useGLAccounts({
    category: 'ASSET',
  });
  const { data: groupsData, isLoading: isLoadingGroups } = useAccountGroups({ limit: 100 });
  const updateCashAccount = useUpdateCashAccount();
  const addToast = useToastStore((s) => s.addToast);

  const isLoading = isLoadingCashAccounts || isLoadingGLAccounts || isLoadingGroups;

  const cashAndBankGroup = useMemo(
    () => (groupsData?.items ?? []).find((g) => g.code === 'CASH_AND_BANK'),
    [groupsData],
  );

  const fixedGroup = useMemo(
    () =>
      cashAndBankGroup
        ? {
            accountType: cashAndBankGroup.classification.category,
            classificationId: cashAndBankGroup.classificationId,
            groupId: cashAndBankGroup.id,
            label: `${cashAndBankGroup.classification.name} > ${cashAndBankGroup.name}`,
          }
        : undefined,
    [cashAndBankGroup],
  );

  const rows = useMemo<Row[]>(() => {
    const linkedGlAccountIds = new Set(cashAccounts.map((ca) => ca.glAccountId));
    const incomplete = glAccounts.filter(
      (g) =>
        g.status === 'ACTIVE' &&
        g.allowPosting &&
        g.accountGroupId === cashAndBankGroup?.id &&
        !linkedGlAccountIds.has(g.id),
    );
    return [
      ...cashAccounts.map(
        (cashAccount): Row => ({ id: cashAccount.id, status: 'complete', cashAccount }),
      ),
      ...incomplete.map(
        (glAccount): Row => ({ id: glAccount.id, status: 'incomplete', glAccount }),
      ),
    ];
  }, [cashAccounts, glAccounts, cashAndBankGroup]);

  const columns = useMemo<Column<Row>[]>(
    () => [
      {
        key: 'name',
        label: 'Account Name',
        width: 'minmax(180px, 1fr)',
        render: (row) =>
          row.status === 'complete' ? (
            <div className="flex flex-col">
              <span className="font-medium text-gray-900">{row.cashAccount.name}</span>
              {row.cashAccount.bankName && (
                <span className="text-xs text-gray-400">{row.cashAccount.bankName}</span>
              )}
            </div>
          ) : (
            <span className="font-medium text-gray-900">{row.glAccount.name}</span>
          ),
      },
      {
        key: 'accountKind',
        label: 'Type',
        width: '130px',
        render: (row) =>
          row.status === 'complete' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
              {KIND_LABEL[row.cashAccount.accountKind]}
            </span>
          ) : (
            <span className="text-gray-400 text-sm">—</span>
          ),
      },
      {
        key: 'currency',
        label: 'Currency',
        width: '100px',
        render: (row) => (
          <span className="text-gray-700 text-sm">
            {row.status === 'complete' ? row.cashAccount.currency : '—'}
          </span>
        ),
      },
      {
        key: 'accountNumber',
        label: 'Account No.',
        width: '150px',
        render: (row) => (
          <span className="text-gray-600 text-sm">
            {row.status === 'complete' ? (row.cashAccount.accountNumber ?? '—') : '—'}
          </span>
        ),
      },
      {
        key: 'glAccount',
        label: 'GL Account',
        width: 'minmax(160px, 1fr)',
        render: (row) => {
          const gl = row.status === 'complete' ? row.cashAccount.glAccount : row.glAccount;
          return (
            <span className="text-gray-700 text-sm">
              {gl.code} – {gl.name}
            </span>
          );
        },
      },
      {
        key: 'isActive',
        label: 'Status',
        width: '130px',
        render: (row) =>
          row.status === 'complete' ? (
            <Badge
              label={row.cashAccount.isActive ? 'Active' : 'Inactive'}
              variant={row.cashAccount.isActive ? 'success' : 'neutral'}
            />
          ) : (
            <Badge label="Setup Required" variant="warning" />
          ),
      },
    ],
    [],
  );

  function deactivate(account: AccountingCashAccount) {
    updateCashAccount.mutate(
      { id: account.id, isActive: false },
      {
        onSuccess: () => setDeactivateTarget(null),
        onError: (error) => addToast({ message: extractError(error), type: 'error' }),
      },
    );
  }

  function reactivate(account: AccountingCashAccount) {
    updateCashAccount.mutate(
      { id: account.id, isActive: true },
      { onError: (error) => addToast({ message: extractError(error), type: 'error' }) },
    );
  }

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) => {
      if (row.status === 'complete') {
        const ca = row.cashAccount;
        return (
          ca.name.toLowerCase().includes(q) ||
          (ca.bankName ?? '').toLowerCase().includes(q) ||
          (ca.accountNumber ?? '').toLowerCase().includes(q) ||
          ca.currency.toLowerCase().includes(q)
        );
      }
      return (
        row.glAccount.name.toLowerCase().includes(q) ||
        row.glAccount.code.toLowerCase().includes(q)
      );
    });
  }, [search, rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search cash/bank accounts…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{
          label: 'Add Cash/Bank Account',
          onClick: () => setAddPanelOpen(true),
        }}
        rowActions={(row) =>
          row.status === 'complete'
            ? [
                { label: 'Update', onClick: () => setEditTarget(row.cashAccount) },
                {
                  label: row.cashAccount.isActive ? 'Deactivate' : 'Reactivate',
                  onClick: () =>
                    row.cashAccount.isActive
                      ? setDeactivateTarget(row.cashAccount)
                      : reactivate(row.cashAccount),
                  danger: row.cashAccount.isActive,
                },
              ]
            : [{ label: 'Complete Setup', onClick: () => setSetupTarget(row.glAccount) }]
        }
        emptyMessage="No cash or bank accounts found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <Modal
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        title="Deactivate Cash/Bank Account"
        description={`Are you sure you want to deactivate "${deactivateTarget?.name}"? It will no longer be selectable for new financial confirmations or cashbook transactions.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={updateCashAccount.isPending}
              onClick={() => deactivateTarget && deactivate(deactivateTarget)}
            >
              Deactivate
            </Button>
          </div>
        }
      />

      <AddLeafAccountPanel
        isOpen={addPanelOpen}
        onClose={() => setAddPanelOpen(false)}
        fixedGroup={fixedGroup}
        onCreated={(account) => {
          setAddPanelOpen(false);
          setSetupTarget(account);
        }}
      />

      <EditCashAccountPanel account={editTarget} onClose={() => setEditTarget(null)} />

      <CompleteCashAccountSetupPanel glAccount={setupTarget} onClose={() => setSetupTarget(null)} />
    </>
  );
}
