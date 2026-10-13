'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { TrendingDown, TrendingUp, Users } from 'lucide-react';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { NumberField } from '@/components/atoms/NumberField';
import { Input } from '@/components/atoms/Input';
import { Avatar } from '@/components/atoms/Avatar';
import { TypeChip } from '@/components/atoms/TypeChip';
import { usePayrollRuns, useRunConfiguredPayroll } from '@/hooks/hr/usePayroll';
import { useToast } from '@/hooks/useToast';
import { ConfirmModal } from '@/components/organisms/hr/payroll/pay-components/ConfirmModal';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import { usePayrollGroups } from '@/hooks/hr/usePayrollGroups';
import {
  payrollConfigurationError,
  usePayrollConfigurations,
} from '@/hooks/hr/usePayrollConfigurations';
import {
  DEFAULT_CURRENCY,
  PAYSLIP_TYPES,
  PAYSLIP_TYPE_ORDER,
  formatAmount,
  localIsoDate,
  type PayslipResult,
  type PayslipTypeKey,
} from '@/lib/payroll-engine';
import { basicFor, buildRows, type RunFigures, type Row } from './runRows';
import { PayslipPanel } from './PayslipPanel';
import { MonthPill, type PayrollMonth } from './MonthPill';
import { PayrollDraftsPanel } from './PayrollDraftsPanel';

const STATUS_LABELS = {
  DRAFT: { label: 'Returned to draft', color: 'gray' },
  PENDING_APPROVAL: { label: 'Waiting for approval', color: 'amber' },
  APPROVED: { label: 'Approved', color: 'green' },
  PAID: { label: 'Paid', color: 'green' },
} as const;

/** The last day of this month, which decides which version of each configuration applies. */
function monthEndIso(now = new Date()): string {
  return localIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

/** Manage Payroll: each payslip type worked out from the employees in its payroll groups. */
export function ManagePayrollContent() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data: employeeData, isLoading: loadingEmployees } = useAllEmployees();
  const groupStore = usePayrollGroups();
  const configStore = usePayrollConfigurations();
  const { data: allRuns = [] } = usePayrollRuns();
  const runPayroll = useRunConfiguredPayroll();
  const toast = useToast();

  const [chosenTab, setTab] = useState<PayslipTypeKey>('monthly');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [figures, setFigures] = useState<RunFigures>({ basic: {}, commission: {}, amounts: {} });
  const [confirmingRun, setConfirmingRun] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [runNote, setRunNote] = useState('');

  const [runMonth, setRunMonth] = useState<PayrollMonth>(() => {
    const today = new Date();
    return { month: today.getMonth() + 1, year: today.getFullYear() };
  });
  const monthDate = new Date(runMonth.year, runMonth.month - 1, 1);
  const period = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const monthEnd = monthEndIso(monthDate);
  const loading = loadingEmployees || groupStore.isLoading || configStore.isLoading;

  const { rows, unassigned } = buildRows({
    employees: employeeData?.data ?? [],
    groups: groupStore.groups,
    configurations: configStore.configurations,
    figures,
    monthEnd,
  });

  const typeOf = (row: Row) => row.configuration.payslipType!;
  // Payslip types nobody is paid through don't get a tab.
  const visibleTypes = PAYSLIP_TYPE_ORDER.filter((key) => rows.some((r) => typeOf(r) === key));
  const tab = visibleTypes.includes(chosenTab) ? chosenTab : (visibleTypes[0] ?? chosenTab);
  const tabRows = rows.filter((r) => typeOf(r) === tab);
  // A run is paid in one currency: the one its configurations share.
  const tabCurrencies = [...new Set(tabRows.map((r) => r.configuration.currency))];
  const currency = tabCurrencies[0] ?? DEFAULT_CURRENCY;
  const visibleRows = tabRows.filter((r) =>
    `${r.employee.firstName} ${r.employee.lastName}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const countFor = (key: PayslipTypeKey) => rows.filter((r) => typeOf(r) === key).length;
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const type = PAYSLIP_TYPES[tab];

  // What has already been run for this month: each payslip type is its own run.
  const monthRuns = allRuns.filter((r) => r.month === runMonth.month && r.year === runMonth.year);
  const drafts = allRuns
    .filter((r) => r.status === 'DRAFT' && r.payslipKey && r.payslipKey !== 'legacy')
    .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));
  const oldSystemRun = monthRuns.find((r) => !r.payslipKey || r.payslipKey === 'legacy');
  const tabRun = monthRuns.find((r) => r.payslipKey === tab);
  // Once a run is with approval (or beyond) its figures are fixed; a run returned to draft can change.
  const locked = !!tabRun && tabRun.status !== 'DRAFT';
  const problems = tabRows.filter((r) => r.problem).length;
  const blockedReason = oldSystemRun
    ? 'Payroll for this month was already run in the old system. See History.'
    : locked
      ? null
      : tabCurrencies.length > 1
        ? `${type.label} payroll uses configurations in different currencies (${tabCurrencies.join(', ')}). Use one currency for them.`
        : unassigned.length > 0
          ? `Running is blocked until everyone on payroll has a payroll group (${unassigned.length} without one). Add them on Payroll Groups.`
          : problems > 0
            ? `${problems} ${problems === 1 ? 'payslip' : 'payslips'} can't be worked out yet. Open ${problems === 1 ? 'it' : 'them'} to see why.`
            : null;

  const runNow = async () => {
    try {
      await runPayroll.mutateAsync({
        payslipType: tab,
        month: runMonth.month,
        year: runMonth.year,
        basicSalaries: Object.fromEntries(
          tabRows.map((r) => [r.id, basicFor(r.employee, figures)]),
        ),
        commissionFigures: Object.fromEntries(
          tabRows.map((r) => [r.id, figures.commission[r.id] ?? 0]),
        ),
        amounts: Object.fromEntries(tabRows.map((r) => [r.id, figures.amounts[r.id] ?? {}])),
        notes: runNote.trim() || undefined,
      });
      setConfirmingRun(false);
      setRunNote('');
      toast.success(`${type.label} payroll sent for approval.`);
    } catch (e) {
      setConfirmingRun(false);
      toast.error(payrollConfigurationError(e, 'Could not run payroll'));
    }
  };

  const total = (pick: (r: PayslipResult) => number, list: Row[] = tabRows) =>
    list.reduce((sum, r) => sum + (r.result ? pick(r.result) : 0), 0);

  const allowanceTotal = (row: Row) =>
    row.components
      .filter((c) => c.enabled && c.kind === 'earning' && c.params.source === 'allowance')
      .reduce((sum, c) => sum + (row.result?.byId.get(c.id)?.amount ?? 0), 0);

  const setBasic = (id: string, value: number) =>
    setFigures((f) => ({ ...f, basic: { ...f.basic, [id]: value } }));
  const setCommission = (id: string, value: number) =>
    setFigures((f) => ({ ...f, commission: { ...f.commission, [id]: value } }));
  const setAmount = (id: string, componentId: string, value: number) =>
    setFigures((f) => ({
      ...f,
      amounts: { ...f.amounts, [id]: { ...f.amounts[id], [componentId]: value } },
    }));

  const money = (row: Row, pick: (r: PayslipResult) => number) =>
    row.result ? formatAmount(pick(row.result), currency) : '-';

  const allColumns: Column<Row>[] = [
    {
      key: 'name',
      label: 'Employee',
      render: (r) => (
        <span className="flex items-center gap-3">
          <Avatar
            name={`${r.employee.firstName} ${r.employee.lastName}`}
            avatarUrl={r.employee.avatarUrl}
            size="sm"
          />
          <span className="flex flex-col">
            <span className="font-medium text-gray-900">
              {r.employee.firstName} {r.employee.lastName}
            </span>
            {r.problem ? (
              <span className="text-xs text-red-600">{r.problem}</span>
            ) : (
              r.employee.department?.name && (
                <span className="text-xs text-gray-500">{r.employee.department.name}</span>
              )
            )}
          </span>
        </span>
      ),
    },
    {
      key: 'group',
      label: 'Group',
      render: (r) => (
        <span className="flex flex-col">
          <span className="text-sm text-gray-900">{r.group.name}</span>
          <span className="text-xs text-gray-500">{r.configuration.name}</span>
        </span>
      ),
    },
    ...(type.inputs.includes('basic')
      ? [
          {
            key: 'basic',
            label: 'Basic salary',
            render: (r: Row) => (
              // Typing here must not open the payslip behind it.
              <div onClick={(e) => e.stopPropagation()}>
                <NumberField
                  ariaLabel={`${r.employee.firstName} ${r.employee.lastName} basic salary`}
                  value={basicFor(r.employee, figures)}
                  disabled={locked}
                  onChange={(value) => setBasic(r.id, value)}
                />
              </div>
            ),
          },
        ]
      : []),
    ...(type.inputs.includes('commission')
      ? [
          {
            key: 'commission',
            label: 'Commission figure',
            render: (r: Row) => (
              // Typing here must not open the payslip behind it.
              <div onClick={(e) => e.stopPropagation()}>
                <NumberField
                  ariaLabel={`${r.employee.firstName} ${r.employee.lastName} commission figure`}
                  value={figures.commission[r.id] ?? 0}
                  disabled={locked}
                  onChange={(value) => setCommission(r.id, value)}
                />
              </div>
            ),
          },
        ]
      : []),
    {
      key: 'allowances',
      label: 'Allowances',
      render: (r) => (
        <span className="tabular-nums">{formatAmount(allowanceTotal(r), currency)}</span>
      ),
    },
    { key: 'gross', label: 'Gross', render: (r) => money(r, (x) => x.gross) },
    { key: 'deductions', label: 'Deductions', render: (r) => money(r, (x) => x.totalDeductions) },
    {
      key: 'net',
      label: 'Net pay',
      render: (r) => <span className="font-semibold text-gray-900">{money(r, (x) => x.net)}</span>,
    },
  ];

  const groupsLink = (
    <Link
      href={`/${tenantSlug}/hr/payroll/payroll-groups`}
      className="font-medium underline underline-offset-2"
    >
      Payroll Groups
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      {groupStore.groups.length > 0 && (
        <div className="grid shrink-0 grid-cols-2 gap-4 md:grid-cols-4">
          {groupStore.groups.map((group) => {
            const groupRows = rows.filter((r) => r.group.id === group.id);
            return (
              <KpiCard
                key={group.id}
                label={group.name}
                value={formatAmount(
                  total((r) => r.employerCost, groupRows),
                  currency,
                )}
                icon={Users}
                iconColor="#2a78d6"
                sub={[{ label: 'Employees', value: group.employeeCount }]}
              />
            );
          })}
        </div>
      )}

      {!loading && groupStore.groups.length === 0 && (
        <div className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">
          Payroll is calculated through payroll groups. Create a group, choose its configuration and
          add its employees on {groupsLink}.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {visibleTypes.length > 0 && (
          <TabBar
            tabs={visibleTypes.map((key) => ({
              key,
              label: PAYSLIP_TYPES[key].label,
              count: countFor(key),
            }))}
            activeTab={tab}
            onTabChange={(key) => setTab(key as PayslipTypeKey)}
          />
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <MonthPill
            value={runMonth}
            onChange={(m) => {
              setRunMonth(m);
              setFigures({ basic: {}, commission: {}, amounts: {} });
              setSelectedId(null);
            }}
          />
          {tabRun ? (
            <TypeChip
              label={STATUS_LABELS[tabRun.status].label}
              color={STATUS_LABELS[tabRun.status].color}
            />
          ) : (
            <TypeChip label="Not run" color="gray" />
          )}
          {blockedReason && <span className="text-amber-700">{blockedReason}</span>}
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Total Gross"
          value={formatAmount(
            total((r) => r.gross),
            currency,
          )}
          icon={TrendingUp}
          iconColor="#2a78d6"
        />
        <KpiCard
          label="Total Net Pay"
          value={formatAmount(
            total((r) => r.net),
            currency,
          )}
          icon={TrendingUp}
          iconColor="#1baf7a"
        />
        <KpiCard
          label="Total Deductions"
          value={formatAmount(
            total((r) => r.totalDeductions),
            currency,
          )}
          icon={TrendingDown}
          iconColor="#eda100"
        />
        <KpiCard
          label="Employer Cost"
          value={formatAmount(
            total((r) => r.employerCost),
            currency,
          )}
          icon={TrendingUp}
          iconColor="#2a78d6"
        />
      </div>

      <DataTable
        columns={allColumns}
        data={visibleRows}
        isLoading={loading}
        searchPlaceholder="Search employee name..."
        searchValue={search}
        onSearch={setSearch}
        secondaryButton={{
          label: 'Drafts',
          badgeCount: drafts.length,
          onClick: () => setDraftsOpen(true),
        }}
        actionButton={{
          label:
            tabRun?.status === 'DRAFT'
              ? `Run ${type.label} payroll again`
              : `Run ${type.label} payroll`,
          onClick: () => setConfirmingRun(true),
          disabled: locked || !!blockedReason || tabRows.length === 0 || runPayroll.isPending,
        }}
        onRowClick={(r) => setSelectedId(r.id)}
        emptyMessage={`No one is paid ${type.label.toLowerCase()} through a payroll group yet.`}
        currentPage={1}
        totalPages={1}
        onPageChange={() => undefined}
        noInternalScroll
      />

      <ConfirmModal
        isOpen={confirmingRun}
        title={`Run ${type.label} payroll?`}
        description={`${tabRows.length} ${tabRows.length === 1 ? 'payslip' : 'payslips'} for ${period} will be worked out and sent for approval. After that the figures are locked.`}
        confirmLabel={runPayroll.isPending ? 'Running…' : 'Run payroll'}
        onCancel={() => setConfirmingRun(false)}
        onConfirm={() => void runNow()}
      >
        <dl className="mb-4 divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
          {[
            ['Payslips', String(tabRows.length)],
            [
              'Total gross',
              formatAmount(
                total((r) => r.gross),
                currency,
              ),
            ],
            [
              'Total deductions',
              formatAmount(
                total((r) => r.totalDeductions),
                currency,
              ),
            ],
            [
              'Total net pay',
              formatAmount(
                total((r) => r.net),
                currency,
              ),
            ],
            [
              'Employer cost',
              formatAmount(
                total((r) => r.employerCost),
                currency,
              ),
            ],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-3 py-2">
              <dt className="text-gray-500">{label}</dt>
              <dd className="font-semibold text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
        <Input
          label="Message (optional)"
          placeholder="Anything the approver should know"
          value={runNote}
          onChange={(e) => setRunNote(e.target.value)}
        />
      </ConfirmModal>

      <PayrollDraftsPanel
        isOpen={draftsOpen}
        onClose={() => setDraftsOpen(false)}
        drafts={drafts}
        onLoad={(run, loaded) => {
          setRunMonth({ month: run.month, year: run.year });
          setFigures(loaded);
          setTab(run.payslipKey as PayslipTypeKey);
        }}
      />

      {selected && (
        <PayslipPanel
          key={selected.id}
          row={selected}
          currency={currency}
          monthEnd={monthEnd}
          readOnly={locked}
          basic={basicFor(selected.employee, figures)}
          onBasic={(value) => setBasic(selected.id, value)}
          commission={figures.commission[selected.id] ?? 0}
          onCommission={(value) => setCommission(selected.id, value)}
          amounts={figures.amounts[selected.id] ?? {}}
          onAmount={(componentId, value) => setAmount(selected.id, componentId, value)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
