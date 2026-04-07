'use client';

import { useState, useMemo } from 'react';
import { SectionCard } from '@/components/molecules/sectionCard';
import { Button } from '@/components/atoms/Button';
import { Column, DataTable } from '../DataTable';

interface PayrollRow {
  id: string;
  employeeName: string;
  avatarUrl?: string;
  basicSalary: number;
  allowances: number;
  grossSalary: number;
  employeeSSNIT: number;
  taxableIncome: number;
  paye: number;
  netSalary: number;
  department?: string;
}

interface ManagePayrollTabProps {
  // We'll connect real data later
  payrollData: PayrollRow[];
  isLoading?: boolean;
  onAllowancesChange: (employeeId: string, newAllowances: number) => void;
  onDownloadPayslip: (employeeId: string) => void;
  onExportFullPayroll: () => void;
}

export function ManagePayrollTab({
  payrollData,
  isLoading = false,
  onAllowancesChange,
  onDownloadPayslip,
  onExportFullPayroll,
}: ManagePayrollTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment] = useState('');

  // Filter data
  const filteredData = useMemo(() => {
    return payrollData.filter((row) => {
      const matchesSearch = row.employeeName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDepartment = !selectedDepartment || row.department === selectedDepartment;
      return matchesSearch && matchesDepartment;
    });
  }, [payrollData, searchQuery, selectedDepartment]);

  // Calculate Totals
  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, row) => ({
        gross: acc.gross + row.grossSalary,
        net: acc.net + row.netSalary,
        paye: acc.paye + row.paye,
        ssnit: acc.ssnit + row.employeeSSNIT,
        employerCost: acc.employerCost + (row.grossSalary + row.employeeSSNIT * (13 / 5.5)), // rough
      }),
      { gross: 0, net: 0, paye: 0, ssnit: 0, employerCost: 0 },
    );
  }, [filteredData]);

  // Table Columns
  const columns: Column<PayrollRow>[] = [
    {
      key: 'employee',
      label: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#0D2244] flex items-center justify-center text-white text-xs font-medium">
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
          onChange={(e) => onAllowancesChange(row.id, Number(e.target.value))}
          className="w-28 px-3 py-1.5 border border-gray-200 rounded-input text-sm focus:outline-none focus:border-[#0D2244]"
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
      render: (row) => (
        <Button variant="outline" size="sm" onClick={() => onDownloadPayslip(row.id)}>
          Payslip
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SectionCard title="Total Gross">
          <p className="text-3xl font-semibold text-gray-900 mt-2">
            GHS {totals.gross.toLocaleString()}
          </p>
        </SectionCard>
        <SectionCard title="Total Net Pay">
          <p className="text-3xl font-semibold text-emerald-600 mt-2">
            GHS {totals.net.toLocaleString()}
          </p>
        </SectionCard>
        <SectionCard title="Total PAYE">
          <p className="text-3xl font-semibold text-amber-600 mt-2">
            GHS {totals.paye.toLocaleString()}
          </p>
        </SectionCard>
        <SectionCard title="Total SSNIT">
          <p className="text-3xl font-semibold text-blue-600 mt-2">
            GHS {totals.ssnit.toLocaleString()}
          </p>
        </SectionCard>
        <SectionCard title="Employer Cost">
          <p className="text-3xl font-semibold text-purple-600 mt-2">
            GHS {totals.employerCost.toLocaleString()}
          </p>
        </SectionCard>
      </div>

      {/* Payroll Table */}
      <SectionCard title="Payroll Management">
        <DataTable
          columns={columns}
          data={filteredData}
          isLoading={isLoading}
          searchPlaceholder="Search employee name..."
          onSearch={setSearchQuery}
          onExport={onExportFullPayroll}
          actionButton={{
            label: 'Export Full Report',
            onClick: onExportFullPayroll,
          }}
          currentPage={1}
          totalPages={1}
          onPageChange={() => {}}
        />
      </SectionCard>
    </div>
  );
}
