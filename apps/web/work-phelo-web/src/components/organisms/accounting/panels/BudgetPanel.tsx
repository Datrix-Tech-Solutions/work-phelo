'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { DatePicker } from '@/components/atoms/DatePicker';
import { MultiSelect, MultiSelectOption } from '@/components/atoms/MultiSelect';
import { SegmentedToggle } from '@/components/atoms/SegmentedToggle';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { useAccountingConfig, useGLAccounts } from '@/hooks';
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
  /** Fired with the assembled payload (and the budget id in edit mode) once the API is wired in. */
  onSaved?: (payload: CreateBudgetPayload, budgetId?: string) => void;
}

export function BudgetPanel({ isOpen, budget, onClose, onSaved }: BudgetPanelProps) {
  const isEdit = !!budget;
  const toast = useToast();
  const { data: config } = useAccountingConfig();
  const { data: accounts = [], isLoading: isLoadingAccounts } = useGLAccounts();

  const [name, setName] = useState('');
  const [period, setPeriod] = useState<BudgetPeriod>('MONTHLY');
  const [startDate, setStartDate] = useState(today);
  const [scope, setScope] = useState<BudgetScope>('BOTH');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const currency = config?.baseCurrency ?? '';

  const blank = () => {
    setName('');
    setPeriod('MONTHLY');
    setStartDate(today());
    setScope('BOTH');
    setSelectedIds([]);
    setAmounts({});
  };

  // Seed the form each time the panel opens — from the budget in edit mode, blank otherwise.
  useEffect(() => {
    if (!isOpen) return;
    if (budget) {
      setName(budget.name);
      setPeriod(budget.period);
      setStartDate(budget.startDate);
      setScope(budget.scope);
      setSelectedIds(budget.lines.map((l) => l.accountId));
      setAmounts(Object.fromEntries(budget.lines.map((l) => [l.accountId, String(l.budgeted)])));
    } else {
      blank();
    }
  }, [isOpen, budget]);

  // Leaf accounts are the postable ones — parent/header accounts don't allow posting. Narrow
  // them to the categories the chosen scope covers, then keep the budget's own line accounts
  // selectable even if one has since been deactivated.
  const accountOptions = useMemo<MultiSelectOption[]>(() => {
    const categories = SCOPE_CATEGORIES[scope];
    const opts = accounts
      .filter((a) => a.status === 'ACTIVE' && a.allowPosting && categories.includes(a.category))
      .map((a) => ({ value: a.id, label: `${a.code} – ${a.name}`, sublabel: a.category }));

    if (budget) {
      const known = new Set(opts.map((o) => o.value));
      for (const l of budget.lines) {
        if (!known.has(l.accountId) && categories.includes(l.category)) {
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

  // Changing the scope can strand accounts that no longer belong — keep only the still-valid ones.
  const allowedIds = useMemo(() => new Set(accountOptions.map((o) => o.value)), [accountOptions]);
  const lineIds = selectedIds.filter((id) => allowedIds.has(id));

  const selectedAccounts = useMemo(
    () => accountOptions.filter((o) => lineIds.includes(o.value)),
    [accountOptions, lineIds],
  );

  const total = lineIds.reduce((sum, id) => sum + (Number(amounts[id]) || 0), 0);

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
    if (lineIds.length === 0) {
      toast.error('Pick at least one account to budget for');
      return;
    }

    const payload: CreateBudgetPayload = {
      name: name.trim(),
      period,
      startDate,
      scope,
      lines: lineIds.map((id) => ({ accountId: id, amount: Number(amounts[id]) || 0 })),
    };

    try {
      setIsSaving(true);
      // TODO: replace with useCreateBudget()/useUpdateBudget() once the budgets API lands.
      onSaved?.(payload, budget?.id);
      toast.success(isEdit ? 'Budget updated' : 'Budget saved');
      close();
    } catch (error) {
      toast.error(
        extractError(error, isEdit ? 'Failed to update budget' : 'Failed to save budget'),
      );
    } finally {
      setIsSaving(false);
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

        <MultiSelect
          label="Accounts"
          placeholder={isLoadingAccounts ? 'Loading accounts…' : 'Select accounts…'}
          options={accountOptions}
          value={lineIds}
          onChange={setSelectedIds}
          hideChips
        />

        {selectedAccounts.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <div className="flex items-center justify-between bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span>Account</span>
              <span>Budgeted Amount</span>
            </div>
            <div className="divide-y divide-gray-100">
              {selectedAccounts.map((opt) => (
                <div key={opt.value} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-900" title={opt.label}>
                    {opt.label}
                  </span>
                  <div className="w-44 shrink-0">
                    <CurrencyInput
                      lockCurrency
                      currency={currency || undefined}
                      value={amounts[opt.value] ?? ''}
                      onValueChange={(v) =>
                        setAmounts((prev) => ({ ...prev, [opt.value]: v }))
                      }
                    />
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
