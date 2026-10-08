'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { TrendingDown, TrendingUp, Users } from 'lucide-react';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { NumberField } from '@/components/atoms/NumberField';
import { TypeChip } from '@/components/atoms/TypeChip';
import { usePayrollSettings } from '@/hooks';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import { usePayrollGroups } from '@/hooks/hr/usePayrollGroups';
import { usePayrollConfigurations } from '@/hooks/hr/usePayrollConfigurations';
import { resolvePayrollCurrency } from '@/lib/payrollDisplay';
import {
  PAYSLIP_TYPES,
  PAYSLIP_TYPE_ORDER,
  formatAmount,
  localIsoDate,
  type PayslipResult,
  type PayslipTypeKey,
} from '@/lib/payroll-engine';
import { buildRows, type RunFigures, type Row } from './runRows';
import { PayslipPanel } from './PayslipPanel';

/** The last day of this month, which decides which version of each configuration applies. */
function monthEndIso(now = new Date()): string {
  return localIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

/** Manage Payroll: each payslip type worked out from the employees in its payroll groups. */
export function ManagePayrollContent() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data: settings } = usePayrollSettings();
  const currency = resolvePayrollCurrency(settings?.payrollCurrency, settings?.payrollCountry);
  const { data: employeeData, isLoading: loadingEmployees } = useAllEmployees();
  const groupStore = usePayrollGroups();
  const configStore = usePayrollConfigurations();

  const [tab, setTab] = useState<PayslipTypeKey>('monthly');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [figures, setFigures] = useState<RunFigures>({ commission: {}, amounts: {} });

  const now = new Date();
  const period = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const monthEnd = monthEndIso(now);
  const loading = loadingEmployees || groupStore.isLoading || configStore.isLoading;

  const { rows } = useMemo(
    () =>
      buildRows({
        employees: employeeData?.data ?? [],
        groups: groupStore.groups,
        configurations: configStore.configurations,
        figures,
        monthEnd,
      }),
    [employeeData, groupStore.groups, configStore.configurations, figures, monthEnd],
  );

  const typeOf = (row: Row) => row.configuration.payslipType!;
  const tabRows = rows.filter((r) => typeOf(r) === tab);
  const visibleRows = tabRows.filter((r) =>
    `${r.employee.firstName} ${r.employee.lastName}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const countFor = (key: PayslipTypeKey) => rows.filter((r) => typeOf(r) === key).length;
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const type = PAYSLIP_TYPES[tab];
  const hasAllowances = tabRows.some((r) =>
    r.components.some((c) => c.enabled && c.params.source === 'allowance'),
  );

  const total = (pick: (r: PayslipResult) => number, list: Row[] = tabRows) =>
    list.reduce((sum, r) => sum + (r.result ? pick(r.result) : 0), 0);

  const allowanceTotal = (row: Row) =>
    row.components
      .filter((c) => c.enabled && c.kind === 'earning' && c.params.source === 'allowance')
      .reduce((sum, c) => sum + (row.result?.byId.get(c.id)?.amount ?? 0), 0);

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
        <span className="flex flex-col">
          <span className="font-medium text-gray-900">
            {r.employee.firstName} {r.employee.lastName}
          </span>
          {r.problem && <span className="text-xs text-red-600">{r.problem}</span>}
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
            render: (r: Row) => formatAmount(Number(r.employee.basicSalary) || 0, currency),
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
  const columns = allColumns.filter((c) => c.key !== 'allowances' || hasAllowances);

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
        <TabBar
          tabs={PAYSLIP_TYPE_ORDER.map((key) => ({
            key,
            label: PAYSLIP_TYPES[key].label,
            count: countFor(key),
          }))}
          activeTab={tab}
          onTabChange={(key) => setTab(key as PayslipTypeKey)}
        />
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <TypeChip label={period} color="gray" />
          <span>
            Each payslip is worked out with the version of its group&apos;s configuration in force
            on{' '}
            {new Date(`${monthEnd}T00:00:00`).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            . Running payroll comes with stored runs, which are the next step.
          </span>
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
        columns={columns}
        data={visibleRows}
        isLoading={loading}
        searchPlaceholder="Search employee name..."
        searchValue={search}
        onSearch={setSearch}
        actionButton={{
          label: `Run ${type.label} payroll`,
          onClick: () => undefined,
          disabled: true,
        }}
        onRowClick={(r) => setSelectedId(r.id)}
        emptyMessage={`No one is paid ${type.label.toLowerCase()} through a payroll group yet.`}
        currentPage={1}
        totalPages={1}
        onPageChange={() => undefined}
        noInternalScroll
      />

      {selected && (
        <PayslipPanel
          key={selected.id}
          row={selected}
          currency={currency}
          monthEnd={monthEnd}
          readOnly={false}
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
