'use client';

import { useMemo, useState } from 'react';
import { TwoPanelShell } from '@/components/organisms/shared/TwoPanelShell';
import { AccountScope, ChartOfAccountsTree } from '@/components/organisms/accounting/ChartOfAccountsTree';
import { AddClassificationPanel } from '@/components/organisms/accounting/panels/AddClassificationPanel';
import { AddParentAccountPanel } from '@/components/organisms/accounting/panels/AddParentAccountPanel';
import { AddLeafAccountPanel } from '@/components/organisms/accounting/panels/AddLeafAccountPanel';
import { GLAccountDetail } from '@/components/organisms/accounting/GLAccountDetail';
import { GLAccountListPanel } from '@/components/organisms/accounting/GLAccountListPanel';
import { ChartOfAccountsToolbar } from '@/components/molecules/accounting/ChartOfAccountsToolbar';
import { SeedHierarchyDialog } from '@/components/molecules/accounting/SeedHierarchyDialog';
import { getScopedAccounts, getScopeTitle } from '@/lib/accounting/chartOfAccountsScope';
import { buildAccountBalanceMap } from '@/lib/accounting/glAccountBalance';
import {
  useAccountClassifications,
  useAccountGroups,
  useAccountingConfig,
  useGLAccounts,
  useSeedStandardAccountHierarchy,
  useTrialBalanceReport,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

type OpenPanel = 'classification' | 'parent-account' | 'leaf-account' | null;

export default function ChartOfAccountsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [scope, setScope] = useState<AccountScope>({ kind: 'all' });
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const seedHierarchy = useSeedStandardAccountHierarchy();
  const toast = useToast();

  const { data: classificationsData, isLoading: isLoadingClassifications } =
    useAccountClassifications();
  const { data: groupsData, isLoading: isLoadingGroups } = useAccountGroups();
  const { data: glAccountsData, isLoading: isLoadingGLAccounts } = useGLAccounts();
  const { data: config } = useAccountingConfig();
  const { data: trialBalance } = useTrialBalanceReport(
    { asOfDate: new Date().toISOString().slice(0, 10), includeZeroBalances: true },
    true,
  );

  const classifications = useMemo(() => classificationsData?.items ?? [], [classificationsData]);
  const groups = useMemo(() => groupsData?.items ?? [], [groupsData]);
  const glAccounts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (glAccountsData ?? []).filter((account) => {
      const matchesSearch =
        !normalizedSearch ||
        account.code.toLowerCase().includes(normalizedSearch) ||
        account.name.toLowerCase().includes(normalizedSearch) ||
        account.description?.toLowerCase().includes(normalizedSearch);
      return matchesSearch && (!status || account.status === status);
    });
  }, [glAccountsData, search, status]);

  const hasAccountFilter = Boolean(search.trim() || status);
  const isLoading = isLoadingClassifications || isLoadingGroups || isLoadingGLAccounts;

  const scopedAccounts = useMemo(
    () => getScopedAccounts(scope, glAccounts, groups),
    [scope, glAccounts, groups],
  );
  const scopeTitle = useMemo(() => getScopeTitle(scope), [scope]);
  const balanceByAccountId = useMemo(() => buildAccountBalanceMap(trialBalance), [trialBalance]);

  const seedStandardHierarchy = async () => {
    try {
      const result = await seedHierarchy.mutateAsync();
      setSeedDialogOpen(false);
      toast.success(
        `Standard hierarchy updated: ${result.classificationsCreated} classifications and ${result.groupsCreated} groups created.`,
      );
    } catch (error) {
      toast.error(extractError(error, 'Unable to seed the standard account hierarchy'));
    }
  };

  return (
    <>
      <TwoPanelShell
        defaultCollapsed
        header={
          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-gray-900">Chart of Accounts</h2>
            <ChartOfAccountsToolbar
              search={search}
              onSearchChange={setSearch}
              status={status}
              onStatusChange={setStatus}
              registerActions={[
                {
                  label: 'Classification',
                  description: 'e.g. Current Assets',
                  onClick: () => setOpenPanel('classification'),
                },
                {
                  label: 'Parent Account',
                  description: 'e.g. Bank Accounts',
                  onClick: () => setOpenPanel('parent-account'),
                },
                {
                  label: 'Leaf Account',
                  description: 'e.g. Ecobank',
                  onClick: () => setOpenPanel('leaf-account'),
                },
                
              ]}
            />
          </div>
        }
        leftPanel={({ collapsed, expand }) => (
          <ChartOfAccountsTree
            collapsed={collapsed}
            onExpand={expand}
            classifications={classifications}
            groups={groups}
            glAccounts={glAccounts}
            isLoading={isLoading}
            hasAccountFilter={hasAccountFilter}
            scope={scope}
            onSelectScope={setScope}
          />
        )}
        rightPanel={
          scope.kind === 'account' ? (
            <GLAccountDetail account={scope.account} />
          ) : (
            <GLAccountListPanel
              title={scopeTitle}
              accounts={scopedAccounts}
              isLoading={isLoading}
              onSelectAccount={(account) => setScope({ kind: 'account', account })}
              balanceByAccountId={balanceByAccountId}
              baseCurrency={config?.baseCurrency ?? undefined}
              groups={groups}
            />
          )
        }
      />

      <AddClassificationPanel
        isOpen={openPanel === 'classification'}
        onClose={() => setOpenPanel(null)}
      />
      <AddParentAccountPanel
        isOpen={openPanel === 'parent-account'}
        onClose={() => setOpenPanel(null)}
      />
      <AddLeafAccountPanel
        isOpen={openPanel === 'leaf-account'}
        onClose={() => setOpenPanel(null)}
      />
      <SeedHierarchyDialog
        isOpen={seedDialogOpen}
        onClose={() => setSeedDialogOpen(false)}
        onConfirm={seedStandardHierarchy}
        isPending={seedHierarchy.isPending}
      />
    </>
  );
}
