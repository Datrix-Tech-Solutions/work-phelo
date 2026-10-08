'use client';

import { useMemo, useState } from 'react';
import { Download, AlertCircle, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { Column, DataTable } from '../../shared/DataTable';
import { usePayrollRuns, usePayrollRun, useAllEmployees, usePayrollSettings } from '@/hooks';
import { PayrollItem, PayrollRun } from '@/types/hr';
import { payrollMonthLabel } from '@/lib/payrollUtils';
import { formatPayrollMoney } from '@/lib/payrollDisplay';

type Kind = 'employee' | 'employer' | 'pension';

const TABS: { key: Kind; label: string }[] = [
  { key: 'employee', label: 'Employee social security' },
  { key: 'employer', label: 'Employer social security' },
  { key: 'pension', label: 'Pension' },
];

const COPY: Record<Kind, { amount: string; total: string; empty: string }> = {
  employee: {
    amount: 'Employee contribution',
    total: 'Total employee contributions',
    empty: 'No employee social security in this run',
  },
  employer: {
    amount: 'Employer contribution',
    total: 'Total employer contributions',
    empty: 'No employer social security in this run',
  },
  pension: {
    amount: 'Pension contribution',
    total: 'Total pension contributions',
    empty: 'No pension contributions in this run',
  },
};

function fmtStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function runLabel(run: PayrollRun) {
  return payrollMonthLabel(run.month, run.year);
}

const num = (value?: string | null) => parseFloat(value || '0') || 0;

/**
 * Runs made by the configurable engine carry the role amounts directly. Older
 * runs only have the Ghana tier columns, so they are mapped onto the same
 * three roles: tiers 1 and 2 go to the social security scheme, tier 3 is the
 * private pension.
 */
function amountFor(item: PayrollItem, kind: Kind, legacy: boolean): number {
  if (legacy) {
    if (kind === 'employee') return num(item.employeeSSNIT);
    if (kind === 'employer') return num(item.employerSSNIT);
    return num(item.tier3Employee);
  }
  if (kind === 'employee') return num(item.employeeSocialSecurity);
  if (kind === 'employer') return num(item.employerSocialSecurity);
  return num(item.pension);
}

interface Row {
  id: string;
  name: string;
  employeeNumber: string;
  idNumber?: string;
  basic: number;
  amount: number;
}

export function SocialSecurityContent() {
  const { data: runs = [], isLoading: runsLoading } = usePayrollRuns();
  const { data: empData } = useAllEmployees();
  const { data: payrollSettings } = usePayrollSettings();
  const [kind, setKind] = useState<Kind>('employee');
  const [selectedRunId, setSelectedRunId] = useState('');

  const availableRuns = useMemo(
    () =>
      runs
        .filter((r) => r.status !== 'DRAFT')
        .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month)),
    [runs],
  );

  const runId = selectedRunId || availableRuns[0]?.id || '';
  const { data: runDetail, isLoading: detailLoading } = usePayrollRun(runId);
  const currency = runDetail?.payrollCurrency ?? payrollSettings?.payrollCurrency;
  const country = runDetail?.payrollCountry ?? payrollSettings?.payrollCountry ?? 'GH';
  const money = (value: number) => formatPayrollMoney(value, currency, country);
  const legacy = !runDetail?.payslipKey || runDetail.payslipKey === 'legacy';

  const idMap = useMemo(() => {
    const map: Record<string, string> = {};
    (empData?.data ?? []).forEach((e) => {
      if (e.ssnit) map[e.id] = e.ssnit;
    });
    return map;
  }, [empData]);

  const rows = useMemo<Row[]>(
    () =>
      (runDetail?.items ?? [])
        .map((item) => ({
          id: item.id,
          name: item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '—',
          employeeNumber: item.employee?.employeeNumber ?? '—',
          idNumber: idMap[item.employeeId],
          basic: num(item.basicSalary),
          amount: amountFor(item, kind, legacy),
        }))
        .filter((r) => r.amount > 0),
    [runDetail, idMap, kind, legacy],
  );

  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const showId = kind !== 'pension';
  const missingCount = showId ? rows.filter((r) => !r.idNumber).length : 0;
  const copy = COPY[kind];

  const handleExport = () => {
    const run = availableRuns.find((r) => r.id === runId);
    const headers = [
      'Employee',
      'Employee Number',
      ...(showId ? ['Social security number'] : []),
      'Basic salary',
      copy.amount,
    ];
    const csvRows = rows.map((r) => [
      `"${r.name}"`,
      r.employeeNumber,
      ...(showId ? [r.idNumber ?? ''] : []),
      r.basic.toFixed(2),
      r.amount.toFixed(2),
    ]);
    const csv = [headers, ...csvRows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${kind}-${run ? runLabel(run).replace(' ', '-') : 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<Row>[] = [
    {
      key: 'employee',
      label: 'Employee',
      width: 'minmax(200px, 1.5fr)',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-400">{row.employeeNumber}</p>
        </div>
      ),
    },
    ...(showId
      ? [
          {
            key: 'idNumber',
            label: 'Social security number',
            width: 'minmax(150px, 1.5fr)',
            render: (row: Row) =>
              row.idNumber ? (
                <span className="font-mono text-sm text-gray-700">{row.idNumber}</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Missing
                </span>
              ),
          },
        ]
      : []),
    {
      key: 'basic',
      label: 'Basic salary',
      width: '120px',
      render: (row) => money(row.basic),
    },
    {
      key: 'amount',
      label: copy.amount,
      width: '160px',
      render: (row) => <span className="font-semibold text-gray-900">{money(row.amount)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <TabBar tabs={TABS} activeTab={kind} onTabChange={(k) => setKind(k as Kind)} />

      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-72">
            <SearchSelect
              placeholder="Select payroll run…"
              options={availableRuns.map<SearchSelectOption>((r) => ({
                value: r.id,
                label: `${runLabel(r)}, ${fmtStatus(r.status)}`,
              }))}
              value={selectedRunId || runId}
              onChange={(v) => setSelectedRunId(v)}
            />
          </div>

          {missingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5" />
              {missingCount} employee{missingCount > 1 ? 's' : ''} missing a number
            </span>
          )}
        </div>

        <Button variant="outline" onClick={handleExport} disabled={!runId || rows.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        <KpiCard label={copy.total} value={money(total)} icon={Wallet} iconColor="#1baf7a" />
        <KpiCard label="Employees" value={String(rows.length)} icon={Users} iconColor="#2a78d6" />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={runsLoading || detailLoading}
        emptyMessage={availableRuns.length === 0 ? 'No completed payroll runs yet' : copy.empty}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
      />
    </div>
  );
}
