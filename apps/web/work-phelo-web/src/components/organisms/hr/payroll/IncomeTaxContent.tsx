'use client';

import { useMemo, useState } from 'react';
import { Download, AlertCircle, Users, Wallet, TrendingUp } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { Column, DataTable } from '../../shared/DataTable';
import { usePayrollRuns, usePayrollRun, useAllEmployees, usePayrollSettings } from '@/hooks';
import { PayrollItem, PayrollRun } from '@/types/hr';
import { payrollMonthLabel } from '@/lib/payrollUtils';
import { currencyTag, formatPayrollMoney } from '@/lib/payrollDisplay';

function fmtStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function runLabel(run: PayrollRun) {
  return payrollMonthLabel(run.month, run.year);
}

const num = (value?: string | null) => parseFloat(value || '0') || 0;

/** Runs from payroll configurations carry income tax directly; older runs keep it as PAYE. */
function taxFor(item: PayrollItem, legacy: boolean): number {
  return legacy ? num(item.payeTax) : num(item.incomeTax);
}

interface Row {
  id: string;
  name: string;
  employeeNumber: string;
  tin?: string;
  gross: number;
  taxable: number;
  tax: number;
}

export function IncomeTaxContent() {
  const { data: runs = [], isLoading: runsLoading } = usePayrollRuns();
  const { data: empData } = useAllEmployees();
  const { data: payrollSettings } = usePayrollSettings();
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

  const tinMap = useMemo(() => {
    const map: Record<string, string> = {};
    (empData?.data ?? []).forEach((e) => {
      if (e.tinNumber) map[e.id] = e.tinNumber;
    });
    return map;
  }, [empData]);

  const rows = useMemo<Row[]>(
    () =>
      (runDetail?.items ?? []).map((item) => ({
        id: item.id,
        name: item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '—',
        employeeNumber: item.employee?.employeeNumber ?? '—',
        tin: tinMap[item.employeeId],
        gross: num(item.grossSalary),
        taxable: num(item.taxableIncome),
        tax: taxFor(item, legacy),
      })),
    [runDetail, tinMap, legacy],
  );

  const totalTax = rows.reduce((sum, r) => sum + r.tax, 0);
  const totalTaxable = rows.reduce((sum, r) => sum + r.taxable, 0);
  const missingCount = rows.filter((r) => r.tax > 0 && !r.tin).length;

  const handleExport = () => {
    const run = availableRuns.find((r) => r.id === runId);
    const headers = [
      'Employee',
      'Employee Number',
      'TIN',
      'Gross pay',
      'Taxable income',
      'Income tax',
    ];
    const csvRows = rows.map((r) => [
      `"${r.name}"`,
      r.employeeNumber,
      r.tin ?? '',
      r.gross.toFixed(2),
      r.taxable.toFixed(2),
      r.tax.toFixed(2),
    ]);
    const csv = [headers, ...csvRows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `income-tax-${run ? runLabel(run).replace(' ', '-') : 'export'}.csv`;
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
    {
      key: 'tin',
      label: 'TIN',
      width: 'minmax(150px, 1.5fr)',
      render: (row) =>
        row.tin ? (
          <span className="font-mono text-sm text-gray-700">{row.tin}</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            Missing
          </span>
        ),
    },
    { key: 'gross', label: 'Gross pay', width: '130px', render: (row) => money(row.gross) },
    {
      key: 'taxable',
      label: 'Taxable income',
      width: '140px',
      render: (row) => money(row.taxable),
    },
    {
      key: 'tax',
      label: 'Income tax',
      width: '140px',
      render: (row) => <span className="font-semibold text-gray-900">{money(row.tax)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-72">
            <SearchSelect
              placeholder="Select payroll run…"
              options={availableRuns.map<SearchSelectOption>((r) => ({
                value: r.id,
                label: `${runLabel(r)}${currencyTag(r, availableRuns)}, ${fmtStatus(r.status)}`,
              }))}
              value={selectedRunId || runId}
              onChange={(v) => setSelectedRunId(v)}
            />
          </div>

          {missingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5" />
              {missingCount} employee{missingCount > 1 ? 's' : ''} missing a TIN
            </span>
          )}
        </div>

        <Button variant="outline" onClick={handleExport} disabled={!runId || rows.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        <KpiCard
          label="Total income tax"
          value={money(totalTax)}
          icon={Wallet}
          iconColor="#1baf7a"
        />
        <KpiCard
          label="Total taxable income"
          value={money(totalTaxable)}
          icon={TrendingUp}
          iconColor="#eda100"
        />
        <KpiCard label="Employees" value={String(rows.length)} icon={Users} iconColor="#2a78d6" />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={runsLoading || detailLoading}
        emptyMessage={
          availableRuns.length === 0 ? 'No completed payroll runs yet' : 'No payslips in this run'
        }
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
      />
    </div>
  );
}
