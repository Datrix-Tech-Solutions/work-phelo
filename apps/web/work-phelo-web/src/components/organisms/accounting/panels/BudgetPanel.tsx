'use client';

import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Icons } from '@/components/atoms/icons';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { SegmentedToggle } from '@/components/atoms/SegmentedToggle';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import {
  useAccountingConfig,
  useCostCentres,
  useCreateBudget,
  useGLAccounts,
  useUpdateBudget,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import {
  BudgetDetail,
  BudgetPeriod,
  BudgetScope,
  CreateBudgetPayload,
  GLAccountCategory,
} from '@/types/accounting';

const PERIOD_OPTIONS: { label: string; value: BudgetPeriod }[] = [
  { label: 'Monthly', value: 'MONTHLY' },
  { label: 'Quarterly', value: 'QUARTERLY' },
  { label: 'Yearly', value: 'YEARLY' },
];

const SCOPE_OPTIONS: { label: string; value: BudgetScope }[] = [
  { label: 'Both', value: 'BOTH' },
  { label: 'Expense only', value: 'EXPENSE' },
  { label: 'Income only', value: 'INCOME' },
];

/** The GL account categories each scope draws its leaf accounts from. */
const SCOPE_CATEGORIES: Record<BudgetScope, GLAccountCategory[]> = {
  EXPENSE: ['EXPENSE'],
  INCOME: ['REVENUE'],
  BOTH: ['EXPENSE', 'REVENUE'],
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

interface BudgetPanelProps {
  isOpen: boolean;
  /** Provide to edit an existing budget; omit (or null) for create mode. */
  budget?: BudgetDetail | null;
  onClose: () => void;
}

/** One editable budget line. A line is unique per account + cost centre (`''` = company-wide). */
interface LineRow {
  key: string;
  accountId: string;
  costCentreId: string;
  amount: string;
}

const COMPANY_WIDE = 'Company-wide (no cost centre)';

export function BudgetPanel({ isOpen, budget, onClose }: BudgetPanelProps) {
  const isEdit = !!budget;
  const toast = useToast();
  const { data: config } = useAccountingConfig();
  const { data: accounts = [], isLoading: isLoadingAccounts } = useGLAccounts();
  const { data: costCentres = [] } = useCostCentres();

  const [name, setName] = useState('');
  const [period, setPeriod] = useState<BudgetPeriod>('MONTHLY');
  const [startDate, setStartDate] = useState(today);
  const [scope, setScope] = useState<BudgetScope>('BOTH');
  const [rows, setRows] = useState<LineRow[]>([]);
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const isSaving = createBudget.isPending || updateBudget.isPending;
  const nextKey = useRef(0);
  const newKey = () => `row-${nextKey.current++}`;

  const currency = config?.baseCurrency ?? '';

  const blank = () => {
    setName('');
    setPeriod('MONTHLY');
    setStartDate(today());
    setScope('BOTH');
    setRows([]);
  };

  // Seed the form each time the panel opens — from the budget in edit mode, blank otherwise.
  // Done during render (not in an effect) and keyed on the budget's id rather than its object,
  // so a background refetch of the same budget never wipes in-progress edits — see
  // https://react.dev/learn/you-might-not-need-an-effect.
  const openKey = isOpen ? (budget?.id ?? 'new') : null;
  const [lastOpenKey, setLastOpenKey] = useState<string | null>(null);
  if (openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    if (budget && openKey !== null) {
      setName(budget.name);
      setPeriod(budget.period);
      setStartDate(budget.startDate);
      setScope(budget.scope);
      setRows(
        budget.lines.map((l) => ({
          // Account + cost centre is unique per budget, so it doubles as a stable key here.
          key: `${l.accountId}:${l.costCentreId ?? ''}`,
          accountId: l.accountId,
          costCentreId: l.costCentreId ?? '',
          amount: String(l.budgeted),
        })),
      );
    } else if (openKey !== null) {
      blank();
    }
  }

  // Leaf accounts are the postable ones — parent/header accounts don't allow posting. Narrow
  // them to the categories the chosen scope covers, then keep the budget's own line accounts
  // selectable even if one has since been deactivated.
  const accountOptions = useMemo<SearchSelectOption[]>(() => {
    const categories = SCOPE_CATEGORIES[scope];
    const opts = accounts
      .filter((a) => a.status === 'ACTIVE' && a.allowPosting && categories.includes(a.category))
      .map((a) => ({ value: a.id, label: `${a.code} – ${a.name}`, sublabel: a.category }));

    if (budget) {
      const known = new Set(opts.map((o) => o.value));
      for (const l of budget.lines) {
        if (!known.has(l.accountId) && categories.includes(l.category)) {
          known.add(l.accountId);
          opts.push({
            value: l.accountId,
            label: `${l.accountCode} – ${l.accountName}`,
            sublabel: l.category,
          });
        }
      }
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [accounts, scope, budget]);

  // Active cost centres, plus any the budget already uses that have since been deactivated.
  const costCentreOptions = useMemo<SearchSelectOption[]>(() => {
    const opts = costCentres
      .filter((c) => c.status === 'ACTIVE')
      .map((c) => ({ value: c.id, label: `${c.code} – ${c.name}` }));
    const known = new Set(opts.map((o) => o.value));
    for (const l of budget?.lines ?? []) {
      if (l.costCentreId && !known.has(l.costCentreId)) {
        known.add(l.costCentreId);
        opts.push({ value: l.costCentreId, label: `${l.costCentreCode} – ${l.costCentreName}` });
      }
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [costCentres, budget]);

  // Changing the scope can strand accounts that no longer belong — keep only the still-valid rows.
  const accountLabels = useMemo(
    () => new Map(accountOptions.map((o) => [o.value, o.label])),
    [accountOptions],
  );
  const lineRows = rows.filter((r) => accountLabels.has(r.accountId));

  const total = lineRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const addAccount = (accountId: string) => {
    if (!accountId) return;
    setRows((prev) => [...prev, { key: newKey(), accountId, costCentreId: '', amount: '' }]);
  };

  const updateRow = (key: string, patch: Partial<LineRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  // Splitting an account across cost centres = another row for the same account, right below it.
  const splitRow = (key: string) =>
    setRows((prev) => {
      const i = prev.findIndex((r) => r.key === key);
      if (i < 0) return prev;
      const copy: LineRow = {
        key: newKey(),
        accountId: prev[i].accountId,
        costCentreId: '',
        amount: '',
      };
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });

  const fmt = (n: number) =>
    `${currency ? `${currency} ` : ''}${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const close = () => {
    blank();
    onClose();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Enter a budget name');
      return;
    }
    if (lineRows.length === 0) {
      toast.error('Add at least one account to budget for');
      return;
    }

    // An account is either budgeted company-wide (one line) or split across cost centres —
    // never both, and never the same cost centre twice.
    const byAccount = new Map<string, LineRow[]>();
    for (const r of lineRows)
      byAccount.set(r.accountId, [...(byAccount.get(r.accountId) ?? []), r]);
    for (const [accountId, group] of byAccount) {
      if (group.length < 2) continue;
      const label = accountLabels.get(accountId) ?? 'An account';
      if (group.some((r) => r.costCentreId === '')) {
        toast.error(
          `${label}: pick a cost centre on every line, or keep a single company-wide line`,
        );
        return;
      }
      if (new Set(group.map((r) => r.costCentreId)).size !== group.length) {
        toast.error(`${label} is listed twice for the same cost centre`);
        return;
      }
    }

    const payload: CreateBudgetPayload = {
      name: name.trim(),
      period,
      startDate,
      scope,
      lines: lineRows.map((r) => ({
        accountId: r.accountId,
        costCentreId: r.costCentreId || null,
        amount: Number(r.amount) || 0,
      })),
    };

    try {
      if (budget) {
        await updateBudget.mutateAsync({ id: budget.id, ...payload });
      } else {
        await createBudget.mutateAsync(payload);
      }
      toast.success(isEdit ? 'Budget updated' : 'Budget saved');
      close();
    } catch (error) {
      toast.error(
        extractError(error, isEdit ? 'Failed to update budget' : 'Failed to save budget'),
      );
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={close}
      title={isEdit ? 'Edit Budget' : 'Create Budget'}
      description="Set a target amount per account for a fiscal period."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={close} disabled={isSaving}>
            Cancel
          </Button>
          <Button isLoading={isSaving} loadingText="Saving…" onClick={handleSave}>
            {isEdit ? 'Save Changes' : 'Save Budget'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Budget Name"
          placeholder="e.g. FY2026 Operating Budget"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Period</label>
          <SegmentedToggle options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        </div>

        <DatePicker label="Start Time" value={startDate} onChange={setStartDate} />

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Budget Scope</label>
          <SegmentedToggle options={SCOPE_OPTIONS} value={scope} onChange={setScope} />
        </div>

        <SearchSelect
          label="Accounts"
          placeholder={isLoadingAccounts ? 'Loading accounts…' : 'Add an account…'}
          options={accountOptions}
          value=""
          onChange={addAccount}
          clearable={false}
          size="md"
        />

        {lineRows.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <div className="flex items-center justify-between bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span>Account · Cost centre</span>
              <span>Budgeted Amount</span>
            </div>
            <div className="divide-y divide-gray-100">
              {lineRows.map((row) => (
                <div key={row.key} className="flex flex-col gap-2 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900"
                      title={accountLabels.get(row.accountId)}
                    >
                      {accountLabels.get(row.accountId)}
                    </span>
                    <button
                      type="button"
                      title="Split by another cost centre"
                      aria-label="Split by another cost centre"
                      onClick={() => splitRow(row.key)}
                      className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                    >
                      <Icons.Plus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Remove line"
                      aria-label="Remove line"
                      onClick={() => removeRow(row.key)}
                      className="rounded-md p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Icons.Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <SearchSelect
                        placeholder="Cost centre"
                        showAllOption
                        allLabel={COMPANY_WIDE}
                        clearable={false}
                        options={costCentreOptions}
                        value={row.costCentreId}
                        onChange={(v) => updateRow(row.key, { costCentreId: v })}
                      />
                    </div>
                    <div className="w-44 shrink-0">
                      <CurrencyInput
                        lockCurrency
                        currency={currency || undefined}
                        value={row.amount}
                        onValueChange={(v) => updateRow(row.key, { amount: v })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-900">
              <span>Total</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
        )}
      </div>
    </SidePanel>
  );
}
