'use client';

import { useState, useMemo, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useMyPayslips } from '@/hooks/usePayroll';
import { PayrollItem } from '@/types/hr';
import {
  payrollMonthLabel,
  downloadPayslipPDF,
  PayslipCompanyInfo,
  PayslipEmployeeInfo,
  PayslipYTD,
} from '@/lib/payrollUtils';
import { useAuthStore } from '@/store/auth.store';
import { useTenant, useMyProfile } from '@/hooks';
import { TaxReturnsPanel } from './TaxReturnsPanel';

function ghs(value: string | number) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return `GHS ${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function payslipLabel(p: PayrollItem) {
  if (!p.payrollRun) return '—';
  return payrollMonthLabel(p.payrollRun.month, p.payrollRun.year);
}

function PayslipRow({
  label,
  value,
  subtle,
  bold,
  green,
}: {
  label: string;
  value: string;
  subtle?: boolean;
  bold?: boolean;
  green?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-2.5 ${subtle ? 'opacity-60' : ''}`}>
      <span className={`text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
        {label}
      </span>
      <span
        className={`text-sm tabular-nums ${
          green
            ? 'font-bold text-emerald-600'
            : bold
              ? 'font-semibold text-gray-900'
              : 'text-gray-800'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-gray-100 my-1" />;
}

export function MyPayslipTab() {
  const { data: payslipsRaw } = useMyPayslips();
  const user = useAuthStore((s) => s.user);
  const { data: tenantData } = useTenant(user?.tenantId ?? '');
  const { data: myProfile } = useMyProfile();
  const employeeBranch = myProfile?.branch;

  const companyInfo: PayslipCompanyInfo = {
    name: user?.tenantName ?? '',
    email: tenantData?.email,
    phone: tenantData?.phone,
  };

  const employeeInfo: PayslipEmployeeInfo | undefined = myProfile
    ? {
        firstName: myProfile.firstName,
        lastName: myProfile.lastName,
        employeeNumber: myProfile.employeeNumber,
        jobTitle: myProfile.jobTitle,
        department: myProfile.department?.name,
        tinNumber: myProfile.tinNumber,
        ssnit: myProfile.ssnit,
        branchName: employeeBranch?.name,
        branchAddress: employeeBranch?.address,
        branchCity: employeeBranch?.city,
        branchRegion: employeeBranch?.region,
        branchCountry: employeeBranch?.country,
        bankName: myProfile.bankName,
        bankBranch: myProfile.bankBranch,
        bankAccountNumber: myProfile.bankAccountNumber,
      }
    : undefined;

  const payslips: PayrollItem[] = useMemo(() => {
    const raw = Array.isArray(payslipsRaw) ? (payslipsRaw as PayrollItem[]) : [];
    return raw
      .filter((p) => p.payrollRun?.status === 'APPROVED' || p.payrollRun?.status === 'PAID')
      .sort((a, b) => {
        const ay = a.payrollRun?.year ?? 0,
          by = b.payrollRun?.year ?? 0;
        const am = a.payrollRun?.month ?? 0,
          bm = b.payrollRun?.month ?? 0;
        return by !== ay ? by - ay : bm - am;
      });
  }, [payslipsRaw]);

  const calcYTD = useCallback(
    (p: PayrollItem): PayslipYTD | undefined => {
      if (!p.payrollRun) return undefined;
      const { year, month } = p.payrollRun;
      const ytdSlips = payslips.filter(
        (s) => s.payrollRun?.year === year && s.payrollRun.month <= month,
      );
      return {
        grossEarnings: ytdSlips.reduce((s, x) => s + parseFloat(x.grossSalary), 0),
        ssnitContribution: ytdSlips.reduce((s, x) => s + parseFloat(x.employeeSSNIT), 0),
        payeTax: ytdSlips.reduce((s, x) => s + parseFloat(x.payeTax), 0),
        netPay: ytdSlips.reduce((s, x) => s + parseFloat(x.netSalary), 0),
      };
    },
    [payslips],
  );

  const [selectedId, setSelectedId] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [taxReturnsOpen, setTaxReturnsOpen] = useState(false);
  const selected: PayrollItem | null =
    payslips.find((p) => p.id === selectedId) ?? payslips[0] ?? null;

  if (payslips.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">No payslips available yet</p>
      </div>
    );
  }

  const runStatus = selected?.payrollRun?.status ?? '';
  const canDownload = runStatus === 'APPROVED' || runStatus === 'PAID';

  const tier3Enabled = selected?.payrollRun?.tier3Enabled ?? false;
  const tier3Label =
    tier3Enabled && selected?.payrollRun?.tier3Rate
      ? `Tier 3 (${(parseFloat(selected.payrollRun.tier3Rate) * 100).toFixed(0)}%)`
      : 'Tier 3';

  const hasOtherDeductions = selected ? parseFloat(selected.otherDeductions) > 0 : false;
  const hasTier3 = tier3Enabled && selected ? parseFloat(selected.tier3Employee) > 0 : false;

  const transportAmt = selected ? parseFloat(selected.transportAmount) : 0;
  const otherAllowances = selected ? parseFloat(selected.totalAllowances) - transportAmt : 0;

  return (
    <>
      <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
        {/* Period selector */}
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-gray-900">My Payslip</h2>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setTaxReturnsOpen(true)}>
              Tax Returns
            </Button>
            <div className="w-52">
              <SearchSelect
                placeholder="Select month…"
                options={payslips.map((p) => ({
                  value: p.id,
                  label: payslipLabel(p),
                  sublabel: p.payrollRun?.status ?? undefined,
                }))}
                value={selected?.id ?? ''}
                onChange={setSelectedId}
              />
            </div>
            {canDownload && (
              <Button
                variant="outline"
                className="flex items-center gap-2"
                disabled={downloading}
                onClick={async () => {
                  if (!selected) return;
                  setDownloading(true);
                  try {
                    await downloadPayslipPDF(
                      selected,
                      payslipLabel(selected),
                      companyInfo,
                      employeeInfo,
                      calcYTD(selected),
                    );
                  } finally {
                    setDownloading(false);
                  }
                }}
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {downloading ? 'Generating…' : 'Download'}
              </Button>
            )}
          </div>
        </div>

        {selected && (
          <>
            {/* Hero */}
            <div
              className="rounded-card px-8 py-4 shrink-0 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, #0D1F44 0%, #1E3A8A 100%)' }}
            >
              <div>
                <p className="text-sm text-blue-300 mb-1">Net Salary</p>
                <p className="text-4xl font-bold text-white tabular-nums">
                  {ghs(selected.netSalary)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-300">{payslipLabel(selected)}</p>
                {selected.payrollRun?.paidAt && (
                  <p className="text-xs text-blue-400 mt-0.5">
                    Paid{' '}
                    {new Date(selected.payrollRun.paidAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
              {/* Earnings */}
              <div className="bg-white border border-gray-200 rounded-card px-6 py-5">
                <p className="text-sm font-semibold text-gray-900 mb-2">Earnings</p>
                <PayslipRow label="Basic Salary" value={ghs(selected.basicSalary)} />
                {transportAmt > 0 && (
                  <PayslipRow label="Transport Allowance" value={ghs(transportAmt)} subtle />
                )}
                {otherAllowances > 0 && (
                  <PayslipRow label="Other Allowances" value={ghs(otherAllowances)} subtle />
                )}
                {parseFloat(selected.overtimePay) > 0 && (
                  <PayslipRow label="Overtime" value={ghs(selected.overtimePay)} subtle />
                )}
                {parseFloat(selected.bonus) > 0 && (
                  <PayslipRow label="Bonus" value={ghs(selected.bonus)} subtle />
                )}
                {parseFloat(selected.thirteenthMonth) > 0 && (
                  <PayslipRow label="13th Month" value={ghs(selected.thirteenthMonth)} subtle />
                )}
                <Divider />
                <PayslipRow label="Gross Salary" value={ghs(selected.grossSalary)} bold />
              </div>

              {/* Deductions */}
              <div className="bg-white border border-gray-200 rounded-card px-6 py-5">
                <p className="text-sm font-semibold text-gray-900 mb-2">Deductions</p>
                <PayslipRow label="Employee SSNIT (5.5%)" value={ghs(selected.employeeSSNIT)} />
                <PayslipRow label="PAYE Tax" value={ghs(selected.payeTax)} />
                {hasTier3 && (
                  <PayslipRow label={tier3Label} value={ghs(selected.tier3Employee)} subtle />
                )}
                {hasOtherDeductions && (
                  <PayslipRow
                    label="Other Deductions"
                    value={ghs(selected.otherDeductions)}
                    subtle
                  />
                )}
                <Divider />
                <PayslipRow label="Total Deductions" value={ghs(selected.totalDeductions)} bold />
              </div>
            </div>

            {/* Net summary */}
            <div className="bg-white border border-gray-200 rounded-card px-6 py-5 shrink-0">
              <PayslipRow label="Gross Salary" value={ghs(selected.grossSalary)} />
              <PayslipRow label="Total Deductions" value={`− ${ghs(selected.totalDeductions)}`} />
              <Divider />
              <PayslipRow label="Net Salary" value={ghs(selected.netSalary)} bold green />
            </div>
          </>
        )}
      </div>

      <TaxReturnsPanel
        isOpen={taxReturnsOpen}
        onClose={() => setTaxReturnsOpen(false)}
        payslips={payslips}
        companyInfo={companyInfo}
        employeeInfo={employeeInfo}
      />
    </>
  );
}
