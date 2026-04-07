'use client';

import { useState, useMemo } from 'react';
import { SectionCard } from '@/components/molecules/sectionCard';
import { Button } from '@/components/atoms/Button';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { calculatePayroll } from '@/lib/payrollCalculations';
import { DetailField } from '@/components/molecules/DetailField';
import { Employee } from '@/types/hr';

interface MyPayslipTabProps {
  employee: Employee | undefined;
}

export function MyPayslipTab({ employee }: MyPayslipTabProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Dummy current payroll data
  const basicSalary = employee?.basicSalary ?? 715;
  const allowances = 1000;

  const payroll = useMemo(
    () => calculatePayroll({ basicSalary, allowances }),
    [basicSalary, allowances],
  );

  const currentMonthName = new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(
    new Date(selectedYear, selectedMonth),
  );

  const handleDownloadPayslip = () => {
    // TODO: Implement Excel download
    alert(`Downloading payslip for ${currentMonthName} ${selectedYear}`);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900">My Payslip</h2>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (selectedMonth === 0) {
                setSelectedMonth(11);
                setSelectedYear((y) => y - 1);
              } else {
                setSelectedMonth((m) => m - 1);
              }
            }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="px-6 py-2 bg-white border border-gray-200 rounded-input font-medium text-gray-900">
            {currentMonthName} {selectedYear}
          </div>

          <button
            onClick={() => {
              if (selectedMonth === 11) {
                setSelectedMonth(0);
                setSelectedYear((y) => y + 1);
              } else {
                setSelectedMonth((m) => m + 1);
              }
            }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div>
            <StatusBadge status="PAID" />
          </div>
          <Button
            onClick={handleDownloadPayslip}
            className="flex items-center gap-2 justify-center"
          >
            <Download className="w-4 h-4" />
            Download Payslip
          </Button>
        </div>
      </div>

      {/* Current Month Summary */}
      <SectionCard title={`${currentMonthName} ${selectedYear} Summary`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Net Salary Big Card */}
          <div className="md:col-span-3 bg-linear-to-br from-[#0D2244] to-[#1a355f] text-white rounded-2xl p-8">
            <p className="text-sm opacity-75">Net Salary</p>
            <p className="text-5xl font-semibold mt-2">GHS {payroll.netSalary.toLocaleString()}</p>
            <p className="text-sm opacity-75 mt-1">
              Paid • {currentMonthName} {selectedYear}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Payroll Breakdown */}
      <SectionCard title="Payroll Breakdown">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
          <DetailField label="Basic Salary" value={`GHS ${payroll.basicSalary.toLocaleString()}`} />
          <DetailField label="Allowances" value={`GHS ${payroll.allowances.toLocaleString()}`} />
          <DetailField label="Gross Salary" value={`GHS ${payroll.grossSalary.toLocaleString()}`} />
          <DetailField
            label="Employee SSNIT"
            value={`GHS ${payroll.employeeSSNIT.toLocaleString()}`}
          />
          <DetailField
            label="Taxable Income"
            value={`GHS ${payroll.taxableIncome.toLocaleString()}`}
          />
          <DetailField label="PAYE" value={`GHS ${payroll.paye.toLocaleString()}`} />
          <DetailField label="Net Salary" value={`GHS ${payroll.netSalary.toLocaleString()}`} />
        </div>
      </SectionCard>

      {/* Employer Contributions */}
      <SectionCard title="Employer Contributions">
        <div className="grid grid-cols-2 gap-x-8 gap-y-6">
          <DetailField
            label="Employer SSNIT"
            value={`GHS ${payroll.employerSSNIT.toLocaleString()}`}
          />
          <DetailField
            label="Total Employer Cost"
            value={`GHS ${payroll.totalEmployerCost.toLocaleString()}`}
          />
        </div>
      </SectionCard>
    </div>
  );
}
