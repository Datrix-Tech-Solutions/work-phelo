'use client';

import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { Button } from '@/components/atoms/Button';
import { MetricCard } from '@/components/molecules/shared/MetricCard';
import { Column, DataTable } from '../shared/DataTable';
import { useEmployees } from '@/hooks/hr/useEmployees';
import { calculatePayroll, AllowanceItem } from '@/lib/payrollCalculations';
import { Employee } from '@/types/hr';
import { PayrollItemsPanel } from './PayrollItemsPanel';

interface PayrollRow {
  id: string;
  employeeName: string;
  avatarUrl?: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  grossSalary: number;
  employeeStatutoryContrib: number;
  employerStatutoryContrib: number;
  taxableIncome: number;
  paye: number;
  netSalary: number;
  totalEmployerCost: number;
  department?: string;
}

export function ManagePayrollTab() {
  const { data: empData, isLoading } = useEmployees();
  const [searchQuery, setSearchQuery] = useState('');
  const [basicMap, setBasicMap] = useState<Record<string, number>>({});
  const [allowancesMap, setAllowancesMap] = useState<Record<string, AllowanceItem[]>>({});
  const [deductionsMap, setDeductionsMap] = useState<Record<string, AllowanceItem[]>>({});
  const [panel, setPanel] = useState<{
    rowId: string;
    rowName: string;
    type: 'allowance' | 'deduction';
  } | null>(null);

  const payrollRows: PayrollRow[] = useMemo(() => {
    const employees: Employee[] = empData?.data ?? [];
    return employees.map((e) => {
      const basic = basicMap[e.id] ?? (Number(e.basicSalary) || 0);
      const allowances = allowancesMap[e.id] ?? [];
      const totalAllowances = allowances.reduce((sum, a) => sum + a.amount, 0);
      const deductionItems = deductionsMap[e.id] ?? [];
      const otherDeductions = deductionItems.reduce((sum, d) => sum + d.amount, 0);
      const calc = calculatePayroll({
        basicSalary: basic,
        allowances,
        otherDeductions,
        country: 'GH',
      });
      return {
        id: e.id,
        employeeName: `${e.firstName} ${e.lastName}`,
        avatarUrl: e.avatarUrl,
        basicSalary: basic,
        allowances: totalAllowances,
        deductions: otherDeductions,

        grossSalary: calc.grossSalary,
        employeeStatutoryContrib: calc.employeeStatutoryContrib,
        employerStatutoryContrib: calc.employerStatutoryContrib,
        taxableIncome: calc.taxableIncome,
        paye: calc.paye,
        netSalary: calc.netSalary,
        totalEmployerCost: calc.totalEmployerCost,
        department: e.department?.name,
      };
    });
  }, [empData, basicMap, allowancesMap, deductionsMap]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return payrollRows;
    const q = searchQuery.toLowerCase();
    return payrollRows.filter((r) => r.employeeName.toLowerCase().includes(q));
  }, [payrollRows, searchQuery]);

  const totals = useMemo(
    () =>
      filteredData.reduce(
        (acc, r) => ({
          gross: acc.gross + r.grossSalary,
          net: acc.net + r.netSalary,
          paye: acc.paye + r.paye,
          ssnit: acc.ssnit + r.employeeStatutoryContrib,
          employerCost: acc.employerCost + r.totalEmployerCost,
        }),
        { gross: 0, net: 0, paye: 0, ssnit: 0, employerCost: 0 },
      ),
    [filteredData],
  );

  const handleBasicChange = (employeeId: string, amount: number) => {
    setBasicMap((prev) => ({ ...prev, [employeeId]: amount }));
  };

  const handlePanelSave = (items: AllowanceItem[]) => {
    if (!panel) return;
    if (panel.type === 'allowance') {
      setAllowancesMap((prev) => ({ ...prev, [panel.rowId]: items }));
    } else {
      setDeductionsMap((prev) => ({ ...prev, [panel.rowId]: items }));
    }
  };

  const columns: Column<PayrollRow>[] = [
    {
      key: 'employee',
      label: 'Employee',
      width: '2fr',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-medium shrink-0">
            {row.employeeName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900">{row.employeeName}</p>
            {row.department && <p className="text-xs text-gray-500">{row.department}</p>}
          </div>
        </div>
      ),
    },

    {
      key: 'basicSalary',
      label: 'Basic Salary',
      render: (row) => (
        <input
          type="number"
          value={row.basicSalary}
          onChange={(e) => handleBasicChange(row.id, Number(e.target.value))}
          className="w-28 px-3 py-1.5 border border-gray-200 rounded-input text-sm focus:outline-none focus:border-brand"
        />
      ),
    },
    {
      key: 'allowances',
      label: 'Allowances',
      render: (row) => (
        <button
          onClick={() => setPanel({ rowId: row.id, rowName: row.employeeName, type: 'allowance' })}
          className="text-left min-w-24"
        >
          <p className="text-sm font-medium text-gray-900">
            {row.allowances > 0 ? `GHS ${row.allowances.toLocaleString()}` : '—'}
          </p>
          <p className="text-xs text-brand">Edit</p>
        </button>
      ),
    },
    {
      key: 'deductions',
      label: 'Deductions',
      render: (row) => (
        <button
          onClick={() => setPanel({ rowId: row.id, rowName: row.employeeName, type: 'deduction' })}
          className="text-left min-w-24"
        >
          <p className="text-sm font-medium text-gray-900">
            {row.deductions > 0 ? `GHS ${row.deductions.toLocaleString()}` : '—'}
          </p>
          <p className="text-xs text-brand">Edit</p>
        </button>
      ),
    },
    {
      key: 'grossSalary',
      label: 'Gross',
      render: (row) => `GHS ${row.grossSalary.toLocaleString()}`,
    },
    {
      key: 'employeeSSNIT',
      label: 'SSNIT',
      render: (row) => `GHS ${row.employeeStatutoryContrib.toLocaleString()}`,
    },
    {
      key: 'taxableIncome',
      label: 'Taxable Income',
      render: (row) => `GHS ${row.taxableIncome.toLocaleString()}`,
    },
    {
      key: 'paye',
      label: 'PAYE',
      render: (row) => `GHS ${row.paye.toLocaleString()}`,
    },
    {
      key: 'netSalary',
      label: 'Net Salary',
      render: (row) => (
        <span className="font-semibold text-emerald-600">GHS {row.netSalary.toLocaleString()}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '72px',
      render: () => (
        <Button variant="outline" size="sm">
          Save
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0">
        <MetricCard
          title="Total Gross"
          value={`GHS ${totals.gross.toLocaleString()}`}
          icon={TrendingUp}
          variant="highlight"
        />
        <MetricCard
          title="Total Net Pay"
          value={`GHS ${totals.net.toLocaleString()}`}
          icon={TrendingUp}
          variant="success"
        />
        <MetricCard
          title="Total PAYE"
          value={`GHS ${totals.paye.toLocaleString()}`}
          icon={TrendingDown}
          variant="warning"
        />
        <MetricCard
          title="Total SSNIT"
          value={`GHS ${totals.ssnit.toLocaleString()}`}
          icon={TrendingUp}
          variant="highlight"
        />
        <MetricCard
          title="Employer Cost"
          value={`GHS ${totals.employerCost.toLocaleString()}`}
          icon={TrendingUp}
          variant="highlight"
        />
      </div>

      <SectionCard title="Payroll Management">
        <DataTable
          columns={columns}
          data={filteredData}
          isLoading={isLoading}
          searchPlaceholder="Search employee name..."
          onSearch={setSearchQuery}
          currentPage={1}
          totalPages={1}
          onPageChange={() => {}}
        />
      </SectionCard>

      <PayrollItemsPanel
        isOpen={!!panel}
        onClose={() => setPanel(null)}
        type={panel?.type ?? 'allowance'}
        employeeName={panel?.rowName ?? ''}
        items={
          panel
            ? panel.type === 'allowance'
              ? (allowancesMap[panel.rowId] ?? [])
              : (deductionsMap[panel.rowId] ?? [])
            : []
        }
        onSave={handlePanelSave}
      />
    </div>
  );
}
