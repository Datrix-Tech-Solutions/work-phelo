'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { usePermission } from '@/hooks/hr/usePermission';
import { usePayrollSettings, useUpdatePayrollSettings } from '@/hooks';
import { Permission } from '@/lib/permissionMap';
import { pageHeader, pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { ToggleRow } from '@/components/molecules/shared/ToggleRow';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { TypeChip } from '@/components/atoms/TypeChip';
import { GLAccountCategory, SeedPayrollAccountsResult } from '@/types/accounting';
import { GL_ACCOUNT_CATEGORY_CHIP_COLOR } from '@/lib/accounting/glAccountCategory';
import { useGLAccounts } from '@/hooks/accounting/useGLAccounts';
import { useSeedPayrollAccounts } from '@/hooks/accounting/usePayrollIntegration';

interface PayrollAccountRow {
  key: string;
  name: string;
  category: GLAccountCategory;
  groupCode: string;
  groupName: string;
  code: string;
  status: 'created' | 'existing' | 'not-created';
}

const CATEGORY_LABELS: Record<GLAccountCategory, string> = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expense',
};

// Keys must match the backend's canonical list exactly (`PAYROLL_ACCOUNT_GROUPS` in
// apps/accounting-service/src/ledger/payroll-integration.service.ts) — the seed request
// matches request items back to its own definitions by `key`, never by code.
const PAYROLL_ACCOUNT_GROUPS: {
  preferredGroupCode: string;
  groupName: string;
  category: GLAccountCategory;
  children: { key: string; name: string }[];
}[] = [
  {
    preferredGroupCode: '1130',
    groupName: 'Staff Advances / Employee Loans',
    category: 'ASSET',
    children: [
      { key: 'staff-advances-receivable', name: 'Staff Advances Receivable' },
      { key: 'employee-loans-receivable', name: 'Employee Loans Receivable' },
    ],
  },
  {
    preferredGroupCode: '2120',
    groupName: 'Payroll Liabilities',
    category: 'LIABILITY',
    children: [
      { key: 'net-pay-payable', name: 'Net Pay Payable' },
      { key: 'income-tax-payable', name: 'Income Tax Payable' },
      { key: 'social-security-payable', name: 'Social Security Payable' },
      { key: 'statutory-pension-payable', name: 'Statutory Pension Payable' },
    ],
  },
  {
    preferredGroupCode: '5120',
    groupName: 'Payroll Expense',
    category: 'EXPENSE',
    children: [
      { key: 'salaries-wages-expense', name: 'Salaries and Wages Expense' },
      {
        key: 'employer-social-security-expense',
        name: 'Employer Social Security Contribution Expense',
      },
      { key: 'employer-pension-expense', name: 'Employer Pension Contribution Expense' },
    ],
  },
];

// Mirrors the backend's codeBand — band width is the code's trailing zeros (e.g. 1130 ->
// width 10, band 1130-1139; 1100 -> width 100, band 1100-1199). Used here only to *preview*
// a likely code before the tenant has actually created anything — the backend recomputes
// this itself and is the authority on the real code.
function codeBandWidth(code: number): number {
  let width = 1;
  while (width < 1000 && code % (width * 10) === 0) width *= 10;
  return width;
}

function findAvailableGroupCode(
  preferredGroupCode: number,
  childCount: number,
  usedCodes: Set<number>,
): number {
  const width = codeBandWidth(preferredGroupCode);
  const maxShift = width * 9;
  for (let shift = 0; shift <= maxShift; shift += width) {
    const groupCode = preferredGroupCode + shift;
    const bandFree = [
      groupCode,
      ...Array.from({ length: childCount }, (_, i) => groupCode + i + 1),
    ].every((code) => !usedCodes.has(code));
    if (bandFree) return groupCode;
  }
  return preferredGroupCode;
}

function buildPayrollAccountRows(
  existingGlAccounts: {
    code: string;
    name: string;
    accountGroup: { code: string; name: string } | null;
  }[],
  nameOverrides: Record<string, string>,
  seedResult: SeedPayrollAccountsResult | null,
): PayrollAccountRow[] {
  const seedByKey = new Map((seedResult?.accounts ?? []).map((a) => [a.key, a]));
  const usedCodes = new Set(existingGlAccounts.map((a) => Number(a.code)));
  const existingByGroupAndName = new Map(
    existingGlAccounts
      .filter((a) => a.accountGroup)
      .map((a) => [`${a.accountGroup!.name}::${a.name.trim().toLowerCase()}`, a] as const),
  );

  return PAYROLL_ACCOUNT_GROUPS.flatMap((groupTemplate) => {
    const knownGroup = existingGlAccounts.find(
      (a) => a.accountGroup?.name === groupTemplate.groupName,
    )?.accountGroup;
    const groupCode =
      knownGroup?.code ??
      String(
        findAvailableGroupCode(
          Number(groupTemplate.preferredGroupCode),
          groupTemplate.children.length,
          usedCodes,
        ),
      );

    return groupTemplate.children.map((child, i) => {
      const displayName = nameOverrides[child.key] ?? child.name;
      const seeded = seedByKey.get(child.key);
      if (seeded) {
        return {
          key: child.key,
          name: seeded.name,
          category: groupTemplate.category,
          groupCode,
          groupName: groupTemplate.groupName,
          code: seeded.code || String(Number(groupCode) + i + 1),
          status: seeded.status === 'excluded' ? 'not-created' : seeded.status,
        };
      }
      const reconciled =
        existingByGroupAndName.get(
          `${groupTemplate.groupName}::${displayName.trim().toLowerCase()}`,
        ) ??
        existingByGroupAndName.get(
          `${groupTemplate.groupName}::${child.name.trim().toLowerCase()}`,
        );
      if (reconciled) {
        return {
          key: child.key,
          name: reconciled.name,
          category: groupTemplate.category,
          groupCode,
          groupName: groupTemplate.groupName,
          code: reconciled.code,
          status: 'existing' as const,
        };
      }
      return {
        key: child.key,
        name: displayName,
        category: groupTemplate.category,
        groupCode,
        groupName: groupTemplate.groupName,
        code: String(Number(groupCode) + i + 1),
        status: 'not-created' as const,
      };
    });
  });
}

export default function PayrollSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const canManagePayroll = usePermission(Permission.RUN_PAYROLL);

  const { data: payrollSettings } = usePayrollSettings();
  const updatePayrollSettings = useUpdatePayrollSettings();
  const linkedToAccounting = payrollSettings?.linkedToAccounting ?? false;
  const autoPostOnApproval = payrollSettings?.autoPostOnApproval ?? false;

  function handleLinkedToAccountingChange(value: boolean) {
    updatePayrollSettings.mutate({
      linkedToAccounting: value,
      // Turning integration off must also turn off auto-post, since the
      // backend rejects auto-post being enabled while unlinked.
      ...(value ? {} : { autoPostOnApproval: false }),
    });
  }

  function handleAutoPostOnApprovalChange(value: boolean) {
    updatePayrollSettings.mutate({ autoPostOnApproval: value });
  }

  const [isEditingSelection, setIsEditingSelection] = useState(false);
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
  // Keyed by the account's stable key — codes are never user-editable, only the name.
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({});
  const [seedResult, setSeedResult] = useState<SeedPayrollAccountsResult | null>(null);

  const { data: existingGlAccounts = [] } = useGLAccounts();
  const seedPayrollAccounts = useSeedPayrollAccounts();

  const payrollAccountRows = useMemo(
    () => buildPayrollAccountRows(existingGlAccounts, nameOverrides, seedResult),
    [existingGlAccounts, nameOverrides, seedResult],
  );

  useEffect(() => {
    if (canManagePayroll === false) {
      router.replace(`/${tenantSlug}/hr/payroll`);
    }
  }, [canManagePayroll, tenantSlug, router]);

  if (!canManagePayroll) return null;

  const pendingAccounts = payrollAccountRows.filter(
    (row) => !excludedKeys.has(row.key) && row.status === 'not-created',
  );
  const createdCount = payrollAccountRows.filter((row) => row.status !== 'not-created').length;

  function toggleExcluded(key: string) {
    setExcludedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleNameChange(key: string, name: string) {
    setNameOverrides((prev) => ({ ...prev, [key]: name }));
  }

  function handleCreateAccounts() {
    seedPayrollAccounts.mutate(
      {
        items: payrollAccountRows.map((row) => ({
          key: row.key,
          name: row.name,
          include: !excludedKeys.has(row.key),
        })),
      },
      { onSuccess: (result) => setSeedResult(result) },
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-bold text-gray-900">Payroll Settings</h1>
      </div>
      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto flex flex-col gap-6`}>
        <SectionCard title="Accounting Integration">
          <ToggleRow
            label="Link Payroll to Accounting"
            description="When enabled, approved payroll runs post a draft journal entry to the general ledger for accountant review."
            enabled={linkedToAccounting}
            onChange={handleLinkedToAccountingChange}
          />
        </SectionCard>

        <SectionCard
          title="Payroll GL Accounts"
          className="h-96 flex flex-col"
          contentClassName="flex-1 min-h-0 overflow-y-auto"
          headerAction={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                icon={<Pencil className="w-4 h-4" />}
                onClick={() => setIsEditingSelection((v) => !v)}
                disabled={!linkedToAccounting}
              >
                {isEditingSelection ? 'Done' : 'Edit'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCreateAccounts}
                isLoading={seedPayrollAccounts.isPending}
                loadingText="Creating…"
                disabled={!linkedToAccounting || pendingAccounts.length === 0}
              >
                {pendingAccounts.length > 0
                  ? 'Create Payroll GL Accounts'
                  : createdCount > 0
                    ? 'Accounts Created'
                    : 'All Accounts Excluded'}
              </Button>
            </div>
          }
        >
          <div
            className={cn('flex flex-col', !linkedToAccounting && 'opacity-50 pointer-events-none')}
          >
            <p className="text-sm text-gray-500 mb-4">
              Default accounts used to post payroll accruals: staff advances/loans, payroll
              liabilities per obligation type, and payroll expense.
            </p>
            <div className="flex flex-col divide-y divide-gray-100">
              {payrollAccountRows.map((row) => {
                const isCreated = row.status !== 'not-created';
                const isExcluded = excludedKeys.has(row.key);
                return (
                  <div
                    key={row.key}
                    className={cn(
                      'flex items-center justify-between gap-3 py-2',
                      isExcluded && !isCreated && 'opacity-50',
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {isEditingSelection && (
                        <input
                          type="checkbox"
                          checked={!isExcluded}
                          disabled={isCreated}
                          onChange={() => toggleExcluded(row.key)}
                          className="w-4 h-4 rounded accent-brand shrink-0"
                        />
                      )}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 font-mono text-xs text-gray-500 shrink-0">
                        {row.code}
                      </span>
                      {isEditingSelection ? (
                        <Input
                          value={nameOverrides[row.key] ?? row.name}
                          disabled={isCreated}
                          onChange={(e) => handleNameChange(row.key, e.target.value)}
                          className="px-2 py-1 text-sm max-w-xs"
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {row.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <TypeChip
                        label={CATEGORY_LABELS[row.category]}
                        color={GL_ACCOUNT_CATEGORY_CHIP_COLOR[row.category]}
                      />
                      <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                        {row.groupCode} — {row.groupName}
                      </span>
                      <Badge
                        label={isCreated ? 'Created' : isExcluded ? 'Excluded' : 'Not created'}
                        variant={isCreated ? 'success' : isExcluded ? 'warning' : 'neutral'}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Posting Behavior">
          <div className={cn(!linkedToAccounting && 'opacity-50 pointer-events-none')}>
            <ToggleRow
              label="Auto-post on approval"
              description="Post the accrual journal entry straight to the ledger when a payroll run is approved, skipping manual review on the Journal Entries page."
              enabled={autoPostOnApproval}
              onChange={handleAutoPostOnApprovalChange}
            />
            <p className="text-sm text-gray-500 mt-4">
              {autoPostOnApproval
                ? 'Payroll accruals will post directly to the ledger on approval, one journal entry per approved payroll run.'
                : 'Payroll accruals post as a draft journal entry on approval, one per approved payroll run.'}
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
