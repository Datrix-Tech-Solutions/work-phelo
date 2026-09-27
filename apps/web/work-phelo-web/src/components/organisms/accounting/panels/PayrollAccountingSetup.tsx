'use client';

import { useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { usePayrollSettings, useUpdatePayrollSettings } from '@/hooks';
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
  kind: 'account';
  category: GLAccountCategory;
  groupCode: string;
  groupName: string;
  code: string;
  status: 'created' | 'existing' | 'not-created';
}

interface PayrollTransactionTypeRow {
  key: string;
  name: string;
  kind: 'transactionType';
  code: string;
  status: 'created' | 'existing' | 'not-created';
}

type PayrollSeedRow = PayrollAccountRow | PayrollTransactionTypeRow;

// Must match the backend's WAGE_PAYMENT_TYPE_KEY/NAME exactly (`payroll-integration.service.ts`)
// — a "Wage Payment" transaction type (category PAYABLE), linked to the HR/Payroll source, so
// it's usable on New Transaction without a rule: its offset account/amount come from picking
// one of the source's open items instead of a preconfigured rule line.
const WAGE_PAYMENT_TYPE_KEY = 'wage-payment-transaction-type';
const WAGE_PAYMENT_TYPE_NAME = 'Wage Payment';

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
          kind: 'account' as const,
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
          kind: 'account' as const,
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
        kind: 'account' as const,
        category: groupTemplate.category,
        groupCode,
        groupName: groupTemplate.groupName,
        code: String(Number(groupCode) + i + 1),
        status: 'not-created' as const,
      };
    });
  });
}

function buildWagePaymentTypeRow(
  nameOverrides: Record<string, string>,
  seedResult: SeedPayrollAccountsResult | null,
): PayrollTransactionTypeRow {
  const displayName = nameOverrides[WAGE_PAYMENT_TYPE_KEY] ?? WAGE_PAYMENT_TYPE_NAME;
  const seeded = seedResult?.accounts.find((a) => a.key === WAGE_PAYMENT_TYPE_KEY);
  if (seeded) {
    return {
      key: WAGE_PAYMENT_TYPE_KEY,
      name: seeded.name,
      kind: 'transactionType',
      code: seeded.code,
      status: seeded.status === 'excluded' ? 'not-created' : seeded.status,
    };
  }
  return {
    key: WAGE_PAYMENT_TYPE_KEY,
    name: displayName,
    kind: 'transactionType',
    code: '—',
    status: 'not-created',
  };
}

/** The payroll module's own accounting integration setup — the toggle, the GL account seed
 *  list, and the posting-behavior toggle. Rendered both from Payroll Settings (its own
 *  module) and from Accounting's Source Types "Manage" panel (in place, without navigating
 *  away), per the Source Types page's own promise to surface each module's setup here. */
export function PayrollAccountingSetup() {
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

  const payrollSeedRows: PayrollSeedRow[] = useMemo(
    () => [
      ...buildPayrollAccountRows(existingGlAccounts, nameOverrides, seedResult),
      buildWagePaymentTypeRow(nameOverrides, seedResult),
    ],
    [existingGlAccounts, nameOverrides, seedResult],
  );

  const pendingAccounts = payrollSeedRows.filter(
    (row) => !excludedKeys.has(row.key) && row.status === 'not-created',
  );
  const createdCount = payrollSeedRows.filter((row) => row.status !== 'not-created').length;
  // Only what's still actionable is worth showing — a row that's already created or matched
  // an existing account has nothing left to do, so it drops off the list entirely rather than
  // sitting there with a "Created" badge forever.
  const visibleRows = payrollSeedRows.filter((row) => row.status === 'not-created');
  const allCreated = visibleRows.length === 0;
  // A transaction type is a different kind of thing from a GL account — grouped separately
  // so it never reads as if it were one.
  const visibleAccountRows = visibleRows.filter(
    (row): row is PayrollAccountRow => row.kind === 'account',
  );
  const visibleTransactionTypeRows = visibleRows.filter(
    (row): row is PayrollTransactionTypeRow => row.kind === 'transactionType',
  );

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
        items: payrollSeedRows.map((row) => ({
          key: row.key,
          name: row.name,
          include: !excludedKeys.has(row.key),
        })),
      },
      { onSuccess: (result) => setSeedResult(result) },
    );
  }

  function renderRow(row: PayrollSeedRow) {
    const isExcluded = excludedKeys.has(row.key);
    return (
      <div
        key={row.key}
        className={cn('flex items-center justify-between gap-3 py-2', isExcluded && 'opacity-50')}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isEditingSelection && (
            <input
              type="checkbox"
              checked={!isExcluded}
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
              onChange={(e) => handleNameChange(row.key, e.target.value)}
              className="px-2 py-1 text-sm max-w-xs"
            />
          ) : (
            <span className="text-sm font-medium text-gray-900 truncate">{row.name}</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {row.kind === 'account' ? (
            <>
              <TypeChip
                label={CATEGORY_LABELS[row.category]}
                color={GL_ACCOUNT_CATEGORY_CHIP_COLOR[row.category]}
              />
              <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                {row.groupCode} — {row.groupName}
              </span>
            </>
          ) : (
            <TypeChip label="Transaction Type" color="teal" />
          )}
          <Badge
            label={isExcluded ? 'Excluded' : 'Not created'}
            variant={isExcluded ? 'warning' : 'neutral'}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Accounting Integration">
        <ToggleRow
          label="Link Payroll to Accounting"
          description="When enabled, approved payroll runs post a draft journal entry to the general ledger for accountant review."
          enabled={linkedToAccounting}
          onChange={handleLinkedToAccountingChange}
        />
      </SectionCard>

      {/* Payroll Accounts and Transaction Types are seeded together by one backend call (a
          transaction type can reference an account it seeds in the same request), so both
          sections' actions drive the same shared handler/state — they're just grouped into
          their own section because a transaction type isn't a kind of account. A future
          third kind of setup item gets its own section the same way. */}
      <SectionCard
        title="Payroll Accounts"
        className={visibleAccountRows.length === 0 ? undefined : 'h-96 flex flex-col'}
        contentClassName={
          visibleAccountRows.length === 0 ? undefined : 'flex-1 min-h-0 overflow-y-auto'
        }
        headerAction={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<Pencil className="w-4 h-4" />}
              onClick={() => setIsEditingSelection((v) => !v)}
              disabled={!linkedToAccounting || allCreated}
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
                ? 'Create Selected'
                : createdCount > 0
                  ? 'All Created'
                  : 'All Excluded'}
            </Button>
          </div>
        }
      >
        <div
          className={cn('flex flex-col', !linkedToAccounting && 'opacity-50 pointer-events-none')}
        >
          <p className="text-sm text-gray-500 mb-4">
            Default GL accounts used to post payroll accruals — staff advances/loans, payroll
            liabilities per obligation type, and payroll expense.
          </p>
          {visibleAccountRows.length === 0 ? (
            <p className="text-sm text-emerald-600 font-medium py-4 text-center">
              All payroll accounts have been created.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100">
              {visibleAccountRows.map(renderRow)}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Transaction Types"
        headerAction={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<Pencil className="w-4 h-4" />}
              onClick={() => setIsEditingSelection((v) => !v)}
              disabled={!linkedToAccounting || allCreated}
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
                ? 'Create Selected'
                : createdCount > 0
                  ? 'All Created'
                  : 'All Excluded'}
            </Button>
          </div>
        }
      >
        <div
          className={cn('flex flex-col', !linkedToAccounting && 'opacity-50 pointer-events-none')}
        >
          <p className="text-sm text-gray-500 mb-4">
            A &quot;Wage Payment&quot; transaction type, linked to the HR/Payroll source, for
            settling payroll liabilities from New Transaction.
          </p>
          {visibleTransactionTypeRows.length === 0 ? (
            <p className="text-sm text-emerald-600 font-medium py-4 text-center">
              All payroll transaction types have been created.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100">
              {visibleTransactionTypeRows.map(renderRow)}
            </div>
          )}
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
  );
}
