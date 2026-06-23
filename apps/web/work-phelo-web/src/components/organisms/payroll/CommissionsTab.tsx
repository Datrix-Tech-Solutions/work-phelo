'use client';

import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Pencil } from 'lucide-react';
import { MetricCard } from '@/components/molecules/shared/MetricCard';
import { Column, DataTable } from '../shared/DataTable';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import { usePayrollSettings } from '@/hooks';
import { formatPayrollMoney, resolvePayrollCurrency } from '@/lib/payrollDisplay';
import { AllowanceItem } from '@/lib/payrollCalculations';
import { Employee } from '@/types/hr';
import { AllowancesPanel } from './AllowancesPanel';
import { DeductionLineItem, DeductionsPanel } from './DeductionsPanel';

const COMMISSION_TAX_RATE = 0.1;

const PAYROLL_ELIGIBLE: Employee['employmentStatus'][] = ['ACTIVE', 'PROBATION', 'ON_LEAVE'];

function CommissionCell({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [local, setLocal] = useState(() => (value === 0 ? '' : String(value)));
  const [focused, setFocused] = useState(false);

  const displayValue =
    focused || local === ''
      ? local
      : Number(local).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      placeholder="0.00"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, '');
        setLocal(raw);
        onChange(raw === '' ? 0 : Number(raw));
      }}
      className="w-28 px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-gray-50 cursor-text hover:border-brand/50 hover:bg-white focus:outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 placeholder:text-gray-300 transition-colors"
    />
  );
}

interface CommissionRow {
  id: string;
  employeeName: string;
  department?: string;
  commission: number;
  allowances: number;
  deductions: number;
  gross: number;
  tax: number;
  net: number;
}

export function CommissionsTab() {
  const { data: empData, isLoading } = useAllEmployees();
  const { data: payrollSettings } = usePayrollSettings();
  const payrollCountry = payrollSettings?.payrollCountry ?? 'GH';
  const payrollCurrency = resolvePayrollCurrency(payrollSettings?.payrollCurrency, payrollCountry);

  const [searchQuery, setSearchQuery] = useState('');
  const [commissionMap, setCommissionMap] = useState<Record<string, number>>({});
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

  const money = (value: number) => formatPayrollMoney(value, payrollCurrency, payrollCountry);

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

  const rows: CommissionRow[] = useMemo(() => {
    const employees = (empData?.data ?? []).filter(
      (e) =>
        PAYROLL_ELIGIBLE.includes(e.employmentStatus) && e.userStatus !== 'PENDING_VERIFICATION',
    );

    return employees.map((e) => {
      const commission = commissionMap[e.id] ?? 0;
      const savedAllowances: AllowanceItem[] =
        e.allowances?.map((a) => ({
          name: a.name ?? (a.type as string),
          type: a.type,
          amount: Number(a.amount),
        })) ?? [];
      const allowances = allowancesMap[e.id] ?? savedAllowances;
      const totalAllowances = allowances.reduce((sum, a) => sum + a.amount, 0);
      const deductionItems = deductionItemsMap[e.id] ?? profileDeductionItems[e.id] ?? [];
      const totalDeductions = deductionItems.reduce((sum, d) => sum + d.amount, 0);

      const gross = Math.max(0, commission + totalAllowances - totalDeductions);
      const tax = gross * COMMISSION_TAX_RATE;
      const net = gross - tax;

      return {
        id: e.id,
        employeeName: `${e.firstName} ${e.lastName}`,
        department: e.department?.name,
        commission,
        allowances: totalAllowances,
        deductions: totalDeductions,
        gross,
        tax,
        net,
      };
    });
  }, [empData, commissionMap, allowancesMap, deductionItemsMap, profileDeductionItems]);

  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) => r.employeeName.toLowerCase().includes(q));
  }, [rows, searchQuery]);

  const totals = useMemo(
    () =>
      filteredRows.reduce(
        (acc, r) => ({ gross: acc.gross + r.gross, tax: acc.tax + r.tax, net: acc.net + r.net }),
        { gross: 0, tax: 0, net: 0 },
      ),
    [filteredRows],
  );

  const columns: Column<CommissionRow>[] = [
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
      key: 'commission',
      label: 'Commission',
      render: (row) => (
        <CommissionCell
          value={row.commission}
          onChange={(n) => setCommissionMap((prev) => ({ ...prev, [row.id]: n }))}
        />
      ),
    },
    {
      key: 'allowances',
      label: 'Allowances',
      render: (row) => (
        <button
          onClick={() => setAllowancePanel({ rowId: row.id, rowName: row.employeeName })}
          className="group w-28 flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-sm text-gray-700 hover:border-brand hover:text-brand hover:bg-brand/5 transition-colors cursor-pointer"
        >
          <span className="truncate">
            {row.allowances > 0 ? (
              row.allowances.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            ) : (
              <span className="text-gray-400">Add</span>
            )}
          </span>
          <Pencil className="w-3 h-3 shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ),
    },
    {
      key: 'deductions',
      label: 'Deductions',
      render: (row) => (
        <button
          onClick={() => setDeductionPanel({ rowId: row.id, rowName: row.employeeName })}
          className="group w-28 flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-sm text-gray-700 hover:border-brand hover:text-brand hover:bg-brand/5 transition-colors cursor-pointer"
        >
          <span className="truncate">
            {row.deductions > 0 ? (
              row.deductions.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            ) : (
              <span className="text-gray-400">Add</span>
            )}
          </span>
          <Pencil className="w-3 h-3 shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ),
    },
    {
      key: 'gross',
      label: 'Gross',
      render: (row) => money(row.gross),
    },
    {
      key: 'tax',
      label: 'Tax (10%)',
      render: (row) => money(row.tax),
    },
    {
      key: 'net',
      label: 'Net Pay',
      render: (row) => <span className="font-semibold text-emerald-600">{money(row.net)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 shrink-0">
        <MetricCard
          title="Total Gross"
          value={money(totals.gross)}
          icon={TrendingUp}
          variant="highlight"
        />
        <MetricCard
          title="Total Tax"
          value={money(totals.tax)}
          icon={TrendingDown}
          variant="warning"
        />
        <MetricCard
          title="Total Net Pay"
          value={money(totals.net)}
          icon={TrendingUp}
          variant="success"
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        isLoading={isLoading}
        emptyMessage="No payroll-eligible employees found."
        searchPlaceholder="Search employee name..."
        onSearch={setSearchQuery}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
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
    </div>
  );
}
