'use client';

import { useParams } from 'next/navigation';
import { DrilldownList, type DrilldownRow } from '@/components/molecules/shared/DrilldownList';
import { fullNumber } from '@/components/molecules/accounting/dashboardChartFormat';
import { DashboardDrilldownPanel } from '@/components/organisms/shared/DashboardDrilldownPanel';
import { useAccountingAccess } from '@/hooks/accounting/useAccountingAccess';
import { useAgingReport } from '@/hooks/accounting/useAgingReports';
import { useCashAccounts } from '@/hooks/accounting/useCashAccounts';
import { buildAgingBlocks } from '@/lib/accounting/aging';

export type AccountingKpi = 'cash' | 'receivables' | 'payables';

const PANELS: Record<
  AccountingKpi,
  { title: string; description: string; expandPath: string; emptyText: string }
> = {
  cash: {
    title: 'Cash Position',
    description: 'Balance of each cash and bank account, as of now',
    expandPath: 'cashandbank',
    emptyText: 'No cash or bank accounts.',
  },
  receivables: {
    title: 'Receivables',
    description: 'What each customer owes today',
    expandPath: 'accountsreceivable/invoices',
    emptyText: 'Nothing is owed to you.',
  },
  payables: {
    title: 'Payables',
    description: 'What is owed to each supplier today',
    expandPath: 'expensesandpurchases/bills',
    emptyText: 'Nothing is owed to suppliers.',
  },
};

const today = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  kpi: AccountingKpi;
  /** The dashboard's currency filter; every currency when empty. */
  currency: string;
}

/** The accounts or parties behind one of the dashboard's balance figures. */
export function AccountingKpiPanel({ isOpen, onClose, kpi, currency }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { canSeePage } = useAccountingAccess();
  const asOfDate = today();
  const cash = useCashAccounts();
  const receivables = useAgingReport('receivables', asOfDate, isOpen && kpi === 'receivables');
  const payables = useAgingReport('payables', asOfDate, isOpen && kpi === 'payables');
  const base = `/${tenantSlug}/accounting`;
  const { title, description, expandPath, emptyText } = PANELS[kpi];
  const shown = (code: string) => !currency || code === currency;
  const money = (code: string, value: number) => `${code} ${fullNumber(value)}`;

  const query = kpi === 'cash' ? cash : kpi === 'receivables' ? receivables : payables;
  let rows: DrilldownRow[] = [];
  if (kpi === 'cash') {
    rows = (cash.data ?? [])
      .filter((account) => shown(account.currency))
      .map((account) => ({
        id: account.id,
        title: account.name,
        detail:
          [account.bankName, account.accountNumber].filter(Boolean).join(' · ') ||
          account.glAccount.name,
        trailing: money(account.currency, Number(account.balance)),
        href: `${base}/cashandbank/${account.id}`,
      }));
  } else {
    const report = (kpi === 'receivables' ? receivables : payables).data;
    const canOpenEntities = canSeePage('entities');
    rows = (report ? buildAgingBlocks(report, '') : [])
      .filter((block) => shown(block.currency))
      .flatMap((block) =>
        block.parties.map((party) => {
          // Aging is in cents; anything past the current bucket is overdue.
          const overdue = party.total - party.buckets.CURRENT;
          return {
            id: `${block.currency}:${party.id}`,
            title: party.name,
            detail:
              overdue > 0 ? `${money(block.currency, overdue / 100)} overdue` : 'Nothing overdue',
            trailing: money(block.currency, party.total / 100),
            href: canOpenEntities ? `${base}/entities/${party.id}` : undefined,
          };
        }),
      );
  }

  return (
    <DashboardDrilldownPanel
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      expandHref={`${base}/${expandPath}`}
    >
      <DrilldownList
        rows={rows}
        isLoading={query.isLoading}
        isError={query.isError}
        emptyText={emptyText}
      />
    </DashboardDrilldownPanel>
  );
}
