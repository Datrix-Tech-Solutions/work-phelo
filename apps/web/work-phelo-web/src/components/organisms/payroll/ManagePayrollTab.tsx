'use client';

import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { Button } from '@/components/atoms/Button';
import { MetricCard } from '@/components/molecules/shared/MetricCard';
import { Column, DataTable } from '../shared/DataTable';
import { useEmployees } from '@/hooks/useEmployees';
import { calculatePayroll } from '@/lib/payrollCalculations';
import { Employee } from '@/types/hr';

interface PayrollRow {
  id: string;
  employeeName: string;
  avatarUrl?: string;
  basicSalary: number;
  allowances: number;
  grossSalary: number;
  employeeSSNIT: number;
  employerSSNIT: number;
  taxableIncome: number;
  paye: number;
  netSalary: number;
  totalEmployerCost: number;
  department?: string;
}

export function ManagePayrollTab() {
  const { data: empData, isLoading } = useEmployees();
  const [searchQuery, setSearchQuery] = useState('');
  const [allowancesMap, setAllowancesMap] = useState<Record<string, number>>({});

  const payrollRows: PayrollRow[] = useMemo(() => {
    const employees: Employee[] = empData?.data ?? [];
    return employees.map((e) => {
      const basic = Number(e.basicSalary) || 0;
      const allowances = allowancesMap[e.id] ?? 1000;
      const calc = calculatePayroll({
        basicSalary: basic,
        allowances,
        country: 'GH',
      });
      return {
        id: e.id,
        employeeName: `${e.firstName} ${e.lastName}`,
        avatarUrl: e.avatarUrl,
        basicSalary: basic,
        allowances,
        grossSalary: calc.grossSalary,
        employeeSSNIT: calc.employeeSSNIT,
        employerSSNIT: calc.employerSSNIT,
        taxableIncome: calc.taxableIncome,
        paye: calc.paye,
        netSalary: calc.netSalary,
        totalEmployerCost: calc.totalEmployerCost,
        department: e.department?.name,
      };
    });
  }, [empData, allowancesMap]);

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
          ssnit: acc.ssnit + r.employeeSSNIT,
          employerCost: acc.employerCost + r.totalEmployerCost,
        }),
        { gross: 0, net: 0, paye: 0, ssnit: 0, employerCost: 0 },
      ),
    [filteredData],
  );

  const handleAllowancesChange = (employeeId: string, value: number) => {
    setAllowancesMap((prev) => ({ ...prev, [employeeId]: value }));
  };

  const columns: Column<PayrollRow>[] = [
    {
      key: 'employee',
      label: 'Employee',
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
      render: (row) => `GHS ${row.basicSalary.toLocaleString()}`,
    },
    {
      key: 'allowances',
      label: 'Allowances',
      render: (row) => (
        <input
          type="number"
          value={row.allowances}
          onChange={(e) => handleAllowancesChange(row.id, Number(e.target.value))}
          className="w-28 px-3 py-1.5 border border-gray-200 rounded-input text-sm focus:outline-none focus:border-brand"
        />
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
      render: (row) => `GHS ${row.employeeSSNIT.toLocaleString()}`,
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
      render: () => (
        <Button variant="outline" size="sm">
          Payslip
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
    </div>
  );
}
