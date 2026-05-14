'use client';

import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Pencil } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { MetricCard } from '@/components/molecules/shared/MetricCard';
import { Column, DataTable } from '../shared/DataTable';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import { calculatePayroll, AllowanceItem } from '@/lib/payrollCalculations';
import { Employee } from '@/types/hr';
import { AllowancesPanel } from './AllowancesPanel';
import { DeductionLineItem, DeductionsPanel } from './DeductionsPanel';
import { RunPayrollPanel, EmployeeOverride } from './RunPayrollPanel';
import { PayrollDraftsPanel, DraftLoadData } from './PayrollDraftsPanel';

function BasicSalaryCell({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [local, setLocal] = useState(() => (value === 0 ? '' : String(value)));

  return (
    <input
      type="number"
      min="0"
      value={local}
      placeholder="0.00"
      onChange={(e) => {
        setLocal(e.target.value);
        onChange(e.target.value === '' ? 0 : Number(e.target.value));
      }}
      className="w-28 px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-gray-50 cursor-text hover:border-brand/50 hover:bg-white focus:outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 placeholder:text-gray-300 transition-colors"
    />
  );
}

interface PayrollRow {
  id: string;
  employeeName: string;
  avatarUrl?: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  grossSalary: number;
  employeeStatutoryContrib: number;
  tier1Contribution: number;
  tier2Contribution: number;
  taxableIncome: number;
  paye: number;
  netSalary: number;
  totalEmployerCost: number;
  department?: string;
}

// Keep in sync with hr-service/src/payroll/payroll.service.ts employee eligibility filter
const PAYROLL_ELIGIBLE: Employee['employmentStatus'][] = ['ACTIVE', 'PROBATION', 'ON_LEAVE'];

function isTransportAllowance(item: AllowanceItem) {
  const label = `${item.type ?? ''} ${item.name ?? ''}`.toLowerCase();
  return label.includes('transport');
}

export function ManagePayrollTab() {
  const { data: empData, isLoading } = useAllEmployees();
  const [searchQuery, setSearchQuery] = useState('');
  const [basicMap, setBasicMap] = useState<Record<string, number>>({});
  const [allowancesMap, setAllowancesMap] = useState<Record<string, AllowanceItem[]>>({});
  const [deductionItemsMap, setDeductionItemsMap] = useState<Record<string, DeductionLineItem[]>>(
    {},
  );

  const [allowancePanel, setAllowancePanel] = useState<{ rowId: string; rowName: string } | null>(
    null,
  );
  const [deductionPanel, setDeductionPanel] = useState<{ rowId: string; rowName: string } | null>(
    null,
  );
  const [runPanelOpen, setRunPanelOpen] = useState(false);
  const [draftsPanelOpen, setDraftsPanelOpen] = useState(false);

  // Initialise deduction line items from employee profile data.
  const profileDeductionItems = useMemo(() => {
    const map: Record<string, DeductionLineItem[]> = {};
    (empData?.data ?? []).forEach((e) => {
      if (e.deductions) {
        map[e.id] = e.deductions
          .filter((d) => d.amountPaid < d.totalAmount)
          .map((d) => {
            const balance = Math.max(0, d.totalAmount - d.amountPaid);
            return {
              employeeDeductionId: d.id,
              name: d.name,
              amount: Math.min(balance, d.monthlyRate),
            };
          })
          .filter((d) => d.amount > 0);
      }
    });
    return map;
  }, [empData]);

  const payrollRows: PayrollRow[] = useMemo(() => {
    const employees: Employee[] = (empData?.data ?? []).filter(
      (e) =>
        PAYROLL_ELIGIBLE.includes(e.employmentStatus) && e.userStatus !== 'PENDING_VERIFICATION',
    );
    return employees.map((e) => {
      const basic = basicMap[e.id] ?? (Number(e.basicSalary) || 0);
      const savedAllowances: AllowanceItem[] =
        e.allowances?.map((a) => ({
          name: a.name ?? (a.type as string),
          type: a.type,
          amount: Number(a.amount),
        })) ?? [];
      const allowances = allowancesMap[e.id] ?? savedAllowances;
      const totalAllowances = allowances.reduce((sum, a) => sum + a.amount, 0);
      const deductionItems = deductionItemsMap[e.id] ?? profileDeductionItems[e.id] ?? [];
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
        tier1Contribution: calc.employerStatutoryContrib,
        tier2Contribution: calc.tier2Contribution ?? 0,
        taxableIncome: calc.taxableIncome,
        paye: calc.paye,
        netSalary: calc.netSalary,
        totalEmployerCost: calc.totalEmployerCost,
        department: e.department?.name,
      };
    });
  }, [empData, basicMap, allowancesMap, deductionItemsMap, profileDeductionItems]);

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
          ssnit:
            acc.ssnit + (r.employeeStatutoryContrib - r.tier2Contribution) + r.tier1Contribution,
          employerCost: acc.employerCost + r.totalEmployerCost,
        }),
        { gross: 0, net: 0, paye: 0, ssnit: 0, employerCost: 0 },
      ),
    [filteredData],
  );

  const overrides = useMemo(() => {
    const result: Record<string, EmployeeOverride> = {};
    Object.entries(basicMap).forEach(([id, val]) => {
      result[id] = { ...result[id], basicSalary: val };
    });
    Object.entries(allowancesMap).forEach(([id, items]) => {
      const totalAllowances = items
        .filter((item) => !isTransportAllowance(item))
        .reduce((sum, item) => sum + item.amount, 0);
      const transportAmount = items
        .filter(isTransportAllowance)
        .reduce((sum, item) => sum + item.amount, 0);
      result[id] = {
        ...result[id],
        totalAllowances,
        transportAmount,
        allowanceItems: items.map((item) => ({
          name: item.name,
          type: item.type ?? null,
          amount: item.amount,
        })),
      };
    });
    Object.entries(deductionItemsMap).forEach(([id, items]) => {
      result[id] = {
        ...result[id],
        otherDeductions: items.reduce((sum, item) => sum + item.amount, 0),
        deductionItems: items,
      };
    });
    return result;
  }, [basicMap, allowancesMap, deductionItemsMap]);

  const handleBasicChange = (employeeId: string, amount: number) => {
    setBasicMap((prev) => ({ ...prev, [employeeId]: amount }));
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
        <BasicSalaryCell value={row.basicSalary} onChange={(n) => handleBasicChange(row.id, n)} />
      ),
    },
    {
      key: 'allowances',
      label: 'Allowances',
      render: (row) => (
        <button
          onClick={() => setAllowancePanel({ rowId: row.id, rowName: row.employeeName })}
          className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-sm text-gray-700 hover:border-brand hover:text-brand hover:bg-brand/5 transition-colors cursor-pointer"
        >
          {row.allowances > 0 ? (
            `GHS ${row.allowances.toLocaleString()}`
          ) : (
            <span className="text-gray-400">Add</span>
          )}
          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ),
    },
    {
      key: 'deductions',
      label: 'Deductions',
      render: (row) => (
        <button
          onClick={() => setDeductionPanel({ rowId: row.id, rowName: row.employeeName })}
          className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-sm text-gray-700 hover:border-brand hover:text-brand hover:bg-brand/5 transition-colors cursor-pointer"
        >
          {row.deductions > 0 ? (
            `GHS ${row.deductions.toLocaleString()}`
          ) : (
            <span className="text-gray-400">Add</span>
          )}
          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
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
      label: 'SSNIT (5.5%)',
      render: (row) =>
        `GHS ${(row.employeeStatutoryContrib - row.tier2Contribution).toLocaleString()}`,
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
  ];

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0">
      <div className="flex items-center justify-end gap-3 shrink-0">
        <Button variant="outline" onClick={() => setDraftsPanelOpen(true)}>
          Drafts
        </Button>
        <Button onClick={() => setRunPanelOpen(true)}>Run Payroll</Button>
      </div>

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
          title="Total SSNIT (18.5%)"
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

      <DataTable
        columns={columns}
        data={filteredData}
        isLoading={isLoading}
        emptyMessage={
          payrollRows.length === 0
            ? 'No payroll-eligible employees found. Employees must be Active or Probation.'
            : 'No employees match your search.'
        }
        searchPlaceholder="Search employee name..."
        onSearch={setSearchQuery}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
      />

      <AllowancesPanel
        isOpen={!!allowancePanel}
        onClose={() => setAllowancePanel(null)}
        employeeId={allowancePanel?.rowId ?? ''}
        employeeName={allowancePanel?.rowName ?? ''}
        onItems={(items) => {
          if (!allowancePanel) return;
          setAllowancesMap((prev) => ({ ...prev, [allowancePanel.rowId]: items }));
        }}
      />

      <DeductionsPanel
        isOpen={!!deductionPanel}
        onClose={() => setDeductionPanel(null)}
        employeeId={deductionPanel?.rowId ?? ''}
        employeeName={deductionPanel?.rowName ?? ''}
        onActiveItems={(items) => {
          if (!deductionPanel) return;
          setDeductionItemsMap((prev) => ({ ...prev, [deductionPanel.rowId]: items }));
        }}
      />

      <RunPayrollPanel
        isOpen={runPanelOpen}
        onClose={() => setRunPanelOpen(false)}
        totals={totals}
        overrides={overrides}
      />

      <PayrollDraftsPanel
        isOpen={draftsPanelOpen}
        onClose={() => setDraftsPanelOpen(false)}
        onLoad={({ basicMap, allowancesMap, deductionItemsMap }: DraftLoadData) => {
          setBasicMap(basicMap);
          setAllowancesMap(allowancesMap);
          setDeductionItemsMap(deductionItemsMap);
        }}
      />
    </div>
  );
}
