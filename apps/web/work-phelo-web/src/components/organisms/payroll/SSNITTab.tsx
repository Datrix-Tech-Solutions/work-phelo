'use client';

import { useState, useMemo } from 'react';
import { Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { MetricCard } from '@/components/molecules/shared/MetricCard';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { Column, DataTable } from '../shared/DataTable';
import { usePayrollRuns, usePayrollRun, useEmployees } from '@/hooks';
import { PayrollItem } from '@/types/hr';
import { payrollMonthLabel } from '@/lib/payrollUtils';

const GH_MAX_INSURABLE = 69_000;
const TIER2_RATE = 0.05;

function fmt(n: number) {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface SSNITRow {
  id: string;
  employeeId: string;
  name: string;
  employeeNumber: string;
  ssnitNumber?: string;
  insurableEarnings: number;
  employeeSSNIT: number;
  employerSSNIT: number;
  totalTier1: number;
  tier2: number;
  tier3Employee: number;
}

function buildRows(items: PayrollItem[], ssnitMap: Record<string, string>): SSNITRow[] {
  return items.map((item) => {
    const basic = parseFloat(item.basicSalary);
    const insurable = Math.min(basic, GH_MAX_INSURABLE);
    const employeeSSNIT = parseFloat(item.employeeSSNIT);
    const employerSSNIT = parseFloat(item.employerSSNIT);
    return {
      id: item.id,
      employeeId: item.employeeId,
      name: item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '—',
      employeeNumber: item.employee?.employeeNumber ?? '—',
      ssnitNumber: ssnitMap[item.employeeId],
      insurableEarnings: insurable,
      employeeSSNIT,
      employerSSNIT,
      totalTier1: employeeSSNIT + employerSSNIT,
      tier2: Math.round(insurable * TIER2_RATE),
      tier3Employee: parseFloat(item.tier3Employee),
    };
  });
}

export function SSNITTab() {
  const { data: runs = [], isLoading: runsLoading } = usePayrollRuns();
  const { data: empData } = useEmployees({ limit: 200 });
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

  const ssnitMap = useMemo(() => {
    const map: Record<string, string> = {};
    (empData?.data ?? []).forEach((e) => {
      if (e.ssnit) map[e.id] = e.ssnit;
    });
    return map;
  }, [empData]);

  const rows = useMemo(
    () => (runDetail?.items ? buildRows(runDetail.items, ssnitMap) : []),
    [runDetail, ssnitMap],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          employeeSSNIT: acc.employeeSSNIT + r.employeeSSNIT,
          employerSSNIT: acc.employerSSNIT + r.employerSSNIT,
          totalTier1: acc.totalTier1 + r.totalTier1,
          tier2: acc.tier2 + r.tier2,
        }),
        { employeeSSNIT: 0, employerSSNIT: 0, totalTier1: 0, tier2: 0 },
      ),
    [rows],
  );

  const missingCount = rows.filter((r) => !r.ssnitNumber).length;
  const tier3Enabled = runDetail?.tier3Enabled ?? false;
  const tier3Label =
    tier3Enabled && runDetail?.tier3Rate
      ? `Tier 3 (${(parseFloat(runDetail.tier3Rate) * 100).toFixed(0)}%)`
      : 'Tier 3';

  const handleExport = () => {
    const run = availableRuns.find((r) => r.id === runId);
    const headers = [
      'Employee',
      'Employee #',
      'SSNIT #',
      'Insurable Earnings',
      'Employee SSNIT (5.5%)',
      'Employer SSNIT (13%)',
      'Total Tier 1 (18.5%)',
      'Tier 2 (5%)',
      ...(tier3Enabled ? [tier3Label] : []),
    ];
    const csvRows = rows.map((r) => [
      r.name,
      r.employeeNumber,
      r.ssnitNumber ?? '',
      r.insurableEarnings.toFixed(2),
      r.employeeSSNIT.toFixed(2),
      r.employerSSNIT.toFixed(2),
      r.totalTier1.toFixed(2),
      r.tier2.toFixed(2),
      ...(tier3Enabled ? [r.tier3Employee.toFixed(2)] : []),
    ]);
    const csv = [headers, ...csvRows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ssnit-${run ? payrollMonthLabel(run.month, run.year).replace(' ', '-') : 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<SSNITRow>[] = [
    {
      key: 'employee',
      label: 'Employee',
      width: '2fr',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-400">{row.employeeNumber}</p>
        </div>
      ),
    },
    {
      key: 'ssnitNumber',
      label: 'SSNIT #',
      render: (row) =>
        row.ssnitNumber ? (
          <span className="font-mono text-sm text-gray-700">{row.ssnitNumber}</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            Missing
          </span>
        ),
    },
    {
      key: 'insurableEarnings',
      label: 'Insurable Earnings',
      render: (row) => fmt(row.insurableEarnings),
    },
    {
      key: 'employeeSSNIT',
      label: 'Employee (5.5%)',
      render: (row) => fmt(row.employeeSSNIT),
    },
    {
      key: 'employerSSNIT',
      label: 'Employer (13%)',
      render: (row) => fmt(row.employerSSNIT),
    },
    {
      key: 'totalTier1',
      label: 'Total Tier 1',
      render: (row) => <span className="font-semibold text-gray-900">{fmt(row.totalTier1)}</span>,
    },
    {
      key: 'tier2',
      label: 'Tier 2 (5%)',
      render: (row) => fmt(row.tier2),
    },
    ...(tier3Enabled
      ? [
          {
            key: 'tier3',
            label: tier3Label,
            render: (row: SSNITRow) => fmt(row.tier3Employee),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-64">
            <SearchSelect
              placeholder="Select payroll run…"
              options={availableRuns.map<SearchSelectOption>((r) => ({
                value: r.id,
                label: payrollMonthLabel(r.month, r.year),
                sublabel: fmtStatus(r.status),
              }))}
              value={selectedRunId || runId}
              onChange={(v) => setSelectedRunId(v)}
            />
          </div>

          {missingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5" />
              {missingCount} employee{missingCount > 1 ? 's' : ''} missing SSNIT #
            </span>
          )}
        </div>

        <Button variant="outline" onClick={handleExport} disabled={!runId || rows.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        <MetricCard
          title="Employee SSNIT (5.5%)"
          value={fmt(totals.employeeSSNIT)}
          variant="default"
        />
        <MetricCard
          title="Employer SSNIT (13%)"
          value={fmt(totals.employerSSNIT)}
          variant="highlight"
        />
        <MetricCard
          title="Total Remittable (18.5%)"
          value={fmt(totals.totalTier1)}
          variant="success"
        />
        <MetricCard
          title="Tier 2 — Separate Fund (5%)"
          value={fmt(totals.tier2)}
          variant="warning"
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={runsLoading || detailLoading}
        emptyMessage={
          availableRuns.length === 0
            ? 'No completed payroll runs yet'
            : 'No payroll items for this run'
        }
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
      />
    </div>
  );
}
