'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Skeleton } from '@/components/atoms/Skeleton';
import { TypeChip } from '@/components/atoms/TypeChip';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { ToggleRow } from '@/components/molecules/shared/ToggleRow';
import { useLinkSourceType, useUnlinkSourceType } from '@/hooks';
import { useGLAccounts } from '@/hooks/accounting/useGLAccounts';
import {
  useCreatePayrollRoleAccount,
  usePayrollSetup,
  useSeedPayrollAccounts,
  useSetPayrollAccountMapping,
  useUpdatePayrollAccountingSettings,
} from '@/hooks/accounting/usePayrollIntegration';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { GL_ACCOUNT_CATEGORY_CHIP_COLOR } from '@/lib/accounting/glAccountCategory';
import type {
  GLAccount,
  PayrollAccountRoleSetup,
  PayrollNotReadyReason,
  SourceTypeDefinition,
} from '@/types/accounting';

const CATEGORY_LABELS = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expense',
} as const;

// What the shortcut creates. The names are the standard ones, so accounts made by an earlier run
// are found rather than duplicated. Anything not listed here is left out.
const STANDARD_ITEMS: { key: string; name: string; include: boolean }[] = [
  { key: 'salaries-wages-expense', name: 'Salaries and Wages Expense', include: true },
  {
    key: 'employer-social-security-expense',
    name: 'Employer Social Security Contribution Expense',
    include: true,
  },
  { key: 'net-pay-payable', name: 'Net Pay Payable', include: true },
  { key: 'income-tax-payable', name: 'Income Tax Payable', include: true },
  { key: 'social-security-payable', name: 'Social Security Payable', include: true },
  { key: 'statutory-pension-payable', name: 'Statutory Pension Payable', include: true },
  { key: 'other-deductions-payable', name: 'Other Deductions Payable', include: true },
  { key: 'wage-payment-transaction-type', name: 'Wage Payment', include: true },
  { key: 'staff-advances-receivable', name: 'Staff Advances Receivable', include: false },
  { key: 'employee-loans-receivable', name: 'Employee Loans Receivable', include: false },
  {
    key: 'employer-pension-expense',
    name: 'Employer Pension Contribution Expense',
    include: false,
  },
];

const NOT_READY_MESSAGES: Record<PayrollNotReadyReason, string> = {
  NOT_LINKED: 'Payroll is not linked, so payroll runs do not post to Accounting.',
  NO_BASE_CURRENCY: 'Set the base currency in Accounting configuration first.',
  ACCOUNTS_MISSING: 'Choose the accounts below that are still missing.',
};

function RoleRow({
  role,
  accounts,
  linked,
}: {
  role: PayrollAccountRoleSetup;
  accounts: GLAccount[];
  linked: boolean;
}) {
  const toast = useToast();
  const setMapping = useSetPayrollAccountMapping();
  const createAccount = useCreatePayrollRoleAccount();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const options = useMemo(
    () =>
      accounts
        .filter((a) => a.category === role.category && a.allowPosting)
        .map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` })),
    [accounts, role.category],
  );

  const handleChange = async (glAccountId: string) => {
    try {
      await setMapping.mutateAsync({ role: role.key, glAccountId: glAccountId || null });
      toast.success(
        glAccountId ? `${role.label} account saved. Applies to future payroll runs.` : 'Cleared.',
      );
    } catch (err) {
      toast.error(extractError(err, 'Could not save the account'));
    }
  };

  const handleCreate = async () => {
    try {
      await createAccount.mutateAsync({ role: role.key, name: newName.trim() || undefined });
      toast.success(`Account created and chosen for ${role.label}.`);
      setCreating(false);
      setNewName('');
    } catch (err) {
      toast.error(extractError(err, 'Could not create the account'));
    }
  };

  return (
    <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{role.label}</span>
            <TypeChip
              label={CATEGORY_LABELS[role.category]}
              color={GL_ACCOUNT_CATEGORY_CHIP_COLOR[role.category]}
            />
            {role.core ? (
              <Badge label="REQUIRED" variant={role.account ? 'success' : 'warning'} />
            ) : (
              <Badge label="IF NEEDED" variant="neutral" />
            )}
          </div>
          <span className="text-xs text-gray-500">{role.description}</span>
        </div>
      </div>

      <SearchSelect
        placeholder={`Choose the ${CATEGORY_LABELS[role.category].toLowerCase()} account…`}
        options={options}
        value={role.account?.id ?? ''}
        onChange={handleChange}
        disabled={setMapping.isPending || createAccount.isPending}
        emptyState={() => (
          <p className="px-3 py-2 text-xs text-gray-500">
            No {CATEGORY_LABELS[role.category].toLowerCase()} account found. Use &quot;New
            account&quot; below.
          </p>
        )}
      />

      {role.openItemCount > 0 && (
        <p className="text-xs text-amber-600">
          {role.openItemCount} unpaid item{role.openItemCount === 1 ? '' : 's'} already raised
          {role.openItemCount === 1 ? ' stays' : ' stay'} on the previous account. Only future
          payroll runs use a new choice.
        </p>
      )}
      {linked && role.core && !role.account && (
        <p className="text-xs text-red-600">
          Payroll is linked, so approving a payroll run is blocked until this is chosen.
        </p>
      )}

      {creating ? (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`Name (default: ${role.label})`}
              className="px-2 py-1 text-sm"
            />
          </div>
          <Button
            size="sm"
            onClick={handleCreate}
            isLoading={createAccount.isPending}
            loadingText="Creating…"
          >
            Create
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div>
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            New account
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Payroll's set-up, owned by Accounting: which of the tenant's own accounts handles each payroll
 * function, whether payroll is linked, and how it is posted. HR has no accounting settings - its
 * approve screen just asks Accounting whether this payroll will be posted.
 */
export function PayrollAccountingSetup({ sourceType }: { sourceType: SourceTypeDefinition }) {
  const toast = useToast();
  const { data: setup, isLoading, isError } = usePayrollSetup();
  const { data: accounts = [] } = useGLAccounts({ status: 'ACTIVE' });
  const link = useLinkSourceType();
  const unlink = useUnlinkSourceType();
  const updateSettings = useUpdatePayrollAccountingSettings();
  const seed = useSeedPayrollAccounts();

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError || !setup) {
    return <p className="text-sm text-red-500">The payroll set-up could not be loaded.</p>;
  }

  const missingCore = setup.roles.filter((r) => r.core && !r.account);
  const everyRoleChosen = setup.roles.every((r) => r.account);

  const handleLinkToggle = async () => {
    try {
      if (setup.linked) {
        await unlink.mutateAsync(sourceType.id);
        toast.success('Payroll unlinked. Payroll runs no longer post to Accounting.');
      } else {
        await link.mutateAsync(sourceType.id);
        toast.success('Payroll linked. New payroll runs will post to Accounting.');
      }
    } catch (err) {
      toast.error(extractError(err, setup.linked ? 'Could not unlink' : 'Could not link'));
    }
  };

  const handleSeed = async () => {
    try {
      await seed.mutateAsync({ items: STANDARD_ITEMS });
      toast.success('Standard payroll accounts created and chosen where nothing was chosen yet.');
    } catch (err) {
      toast.error(extractError(err, 'Could not create the standard accounts'));
    }
  };

  const handleAutoPost = async (value: boolean) => {
    try {
      await updateSettings.mutateAsync(value);
    } catch (err) {
      toast.error(extractError(err, 'Could not save the posting setting'));
    }
  };

  const unlinkBlocked = setup.linked && setup.openLiabilityCount > 0;
  const linkBlocked = !setup.linked && !setup.readyToLink;

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Link Payroll"
        headerAction={
          <Badge
            label={setup.linked ? (setup.ready ? 'LINKED' : 'LINKED, NOT READY') : 'NOT LINKED'}
            variant={setup.linked ? (setup.ready ? 'success' : 'warning') : 'neutral'}
          />
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            {setup.linked
              ? 'Approved payroll runs post to Accounting, and are settled here. HR users see this when they approve a run.'
              : 'Payroll runs on its own until you link it. Once linked, runs approved from then on post an accrual to Accounting. Runs already approved are not changed.'}
          </p>
          {!setup.linked && setup.reason && setup.reason !== 'NOT_LINKED' && (
            <p className="text-xs text-amber-600">
              {NOT_READY_MESSAGES[setup.reason]}
              {setup.reason === 'ACCOUNTS_MISSING' &&
                ` Missing: ${missingCore.map((r) => r.label).join(', ')}.`}
            </p>
          )}
          {setup.linked && !setup.ready && (
            <p className="text-xs text-red-600">
              Approving payroll is blocked until these are chosen:{' '}
              {missingCore.map((r) => r.label).join(', ')}.
            </p>
          )}
          {unlinkBlocked && (
            <p className="text-xs text-amber-600">
              {setup.openLiabilityCount} payroll liabilit
              {setup.openLiabilityCount === 1 ? 'y is' : 'ies are'} still unpaid, so payroll cannot
              be unlinked yet. Settle them from the Source Ledger first.
            </p>
          )}
          <div>
            <Button
              size="sm"
              variant={setup.linked ? 'outline' : 'primary'}
              onClick={handleLinkToggle}
              isLoading={link.isPending || unlink.isPending}
              loadingText={setup.linked ? 'Unlinking…' : 'Linking…'}
              disabled={unlinkBlocked || linkBlocked}
            >
              {setup.linked ? 'Unlink payroll' : 'Link payroll'}
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Payroll Accounts"
        headerAction={
          <Button
            size="sm"
            variant="outline"
            onClick={handleSeed}
            isLoading={seed.isPending}
            loadingText="Creating…"
            disabled={everyRoleChosen && !!setup.wagePaymentType}
          >
            Create standard accounts
          </Button>
        }
      >
        <p className="mb-4 text-sm text-gray-500">
          Choose which of your accounts handles each payroll function, or create one for it. The
          standard-accounts shortcut fills in only what is not chosen yet.
        </p>
        <div className="flex flex-col divide-y divide-gray-100">
          {setup.roles.map((role) => (
            <RoleRow key={role.key} role={role} accounts={accounts} linked={setup.linked} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Settling Payroll">
        <p className="text-sm text-gray-500">
          Net pay, income tax and the other payroll liabilities are paid from the Source Ledger, or
          from New Transaction with a payment type linked to this source.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          {setup.wagePaymentType
            ? `Payment type: ${setup.wagePaymentType.name} (${setup.wagePaymentType.code}).`
            : 'No payment type is linked to Payroll yet. The standard-accounts shortcut creates a "Wage Payment" type, or link one of your own in Transaction Types.'}
        </p>
      </SectionCard>

      <SectionCard title="Posting Behavior">
        <ToggleRow
          label="Auto-post on approval"
          description="Post the accrual journal straight to the ledger when a payroll run is approved, skipping manual review on the Journal Entries page."
          enabled={setup.autoPostOnApproval}
          onChange={handleAutoPost}
          disabled={updateSettings.isPending}
        />
        <p className="mt-4 text-sm text-gray-500">
          {setup.autoPostOnApproval
            ? 'Payroll accruals post directly to the ledger on approval, one journal entry per approved run.'
            : 'Payroll accruals are saved as a draft journal entry on approval, one per approved run, for you to review and post.'}
        </p>
      </SectionCard>
    </div>
  );
}
