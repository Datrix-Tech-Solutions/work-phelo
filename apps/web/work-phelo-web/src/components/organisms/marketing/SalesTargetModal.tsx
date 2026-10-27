'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Input } from '@/components/atoms/Input';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useProspectingSettings } from '@/hooks/marketing/useProspectingSettings';
import { useTargetReps } from '@/hooks/marketing/useSalesTargets';
import { formatDate, formatDateRange } from '@/lib/formatters';
import type {
  CreateSalesTargetPayload,
  SalesTarget,
  UpdateSalesTargetPayload,
} from '@/types/marketing';

interface Props {
  /** The target being edited; its amount and, until it ends, its dates can change. */
  editing: SalesTarget | null;
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: (payload: CreateSalesTargetPayload) => void;
  onUpdate: (id: string, changes: UpdateSalesTargetPayload) => void;
}

type Errors = Partial<Record<'name' | 'userIds' | 'startDate' | 'endDate' | 'amount', string>>;

function iso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Start and end of the current month, quarter or year, to fill the dates in one tap. */
function currentPeriod(kind: 'month' | 'quarter' | 'year'): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  if (kind === 'year')
    return { start: iso(new Date(year, 0, 1)), end: iso(new Date(year, 11, 31)) };
  const span = kind === 'month' ? 1 : 3;
  const first = kind === 'month' ? now.getMonth() : Math.floor(now.getMonth() / 3) * 3;
  return {
    start: iso(new Date(year, first, 1)),
    end: iso(new Date(year, first + span, 0)),
  };
}

const PERIOD_SHORTCUTS = [
  { kind: 'month', label: 'This month' },
  { kind: 'quarter', label: 'This quarter' },
  { kind: 'year', label: 'This year' },
] as const;

export function SalesTargetModal({ editing, isSubmitting, onClose, onCreate, onUpdate }: Props) {
  const { data: reps = [], isLoading: loadingReps } = useTargetReps(!editing);
  const { data: products = [], isLoading: loadingProducts } = useProspectingSettings('products');

  const [name, setName] = useState('');
  const [userIds, setUserIds] = useState<string[]>([]);
  const [productId, setProductId] = useState('');
  const [startDate, setStartDate] = useState(editing?.startDate ?? '');
  const [endDate, setEndDate] = useState(editing?.endDate ?? '');
  const [amount, setAmount] = useState(editing ? String(Number(editing.amount)) : '');
  const [errors, setErrors] = useState<Errors>({});

  /** Dates of a target that has ended are locked; the server refuses to change them. */
  const datesLocked = !!editing && editing.endDate < iso(new Date());

  const repOptions = useMemo(
    () => reps.map((rep) => ({ value: rep.userId, label: rep.name, sublabel: rep.email })),
    [reps],
  );
  const productOptions = useMemo(
    () => products.filter((p) => p.isActive).map((p) => ({ value: p.id, label: p.name })),
    [products],
  );

  function submit() {
    const next: Errors = {};
    const value = Number(amount);
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      next.amount = 'Enter an amount greater than zero';
    }
    if (!editing) {
      if (!name.trim()) next.name = 'Enter a name for the target';
      if (userIds.length === 0) next.userIds = 'Choose at least one sales rep';
    }
    if (!datesLocked) {
      if (!startDate) next.startDate = 'Choose a start date';
      if (!endDate) next.endDate = 'Choose an end date';
      else if (startDate && endDate < startDate)
        next.endDate = 'End date cannot be before the start';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const rounded = Math.round(value * 100) / 100;
    if (editing) {
      onUpdate(
        editing.id,
        datesLocked ? { amount: rounded } : { amount: rounded, startDate, endDate },
      );
    } else {
      onCreate({
        name: name.trim(),
        userIds,
        ...(productId ? { productId } : {}),
        startDate,
        endDate,
        amount: rounded,
      });
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing ? 'Edit Target' : 'New Target'}
      description={
        editing
          ? `${editing.name ? `${editing.name} · ` : ''}${editing.userName ?? 'Sales rep'} · ${editing.productName ?? 'All products/services'} · ${formatDateRange(editing.startDate, editing.endDate)}`
          : 'Set what sales reps should bring in. Each rep chosen gets a target of the full amount, measured on the invoices raised for their clients in the period.'
      }
      width="max-w-lg"
      height="max-h-[90vh]"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} isLoading={isSubmitting}>
            {editing
              ? 'Save Changes'
              : userIds.length > 1
                ? `Create ${userIds.length} Targets`
                : 'Create Target'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!editing && (
          <>
            <Input
              label="Target Name"
              placeholder="e.g. Q1 2026 revenue"
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
            />
            <MultiSelect
              label="Sales Reps"
              placeholder={loadingReps ? 'Loading...' : 'Choose one or more sales reps'}
              options={repOptions}
              value={userIds}
              onChange={setUserIds}
              error={errors.userIds}
            />
            <SearchSelect
              label="Product/Service (optional)"
              placeholder={loadingProducts ? 'Loading...' : 'All products/services'}
              options={productOptions}
              value={productId}
              onChange={(v) => setProductId(v)}
              disabled={loadingProducts}
              clearable
            />
          </>
        )}
        {!datesLocked && (
          <>
            <div className="flex flex-wrap gap-2">
              {PERIOD_SHORTCUTS.map(({ kind, label }) => (
                <Button
                  key={kind}
                  variant="outline"
                  onClick={() => {
                    const period = currentPeriod(kind);
                    setStartDate(period.start);
                    setEndDate(period.end);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={setStartDate}
                error={errors.startDate}
              />
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={setEndDate}
                minDate={startDate || undefined}
                error={errors.endDate}
              />
            </div>
          </>
        )}
        {datesLocked && editing && (
          <p className="text-sm text-gray-500">
            This target ended on {formatDate(editing.endDate)}, so its dates can no longer be
            changed.
          </p>
        )}
        <CurrencyInput
          label={editing ? 'Target Amount' : 'Target Amount (per rep)'}
          currency={editing?.currency ?? 'GHS'}
          lockCurrency
          value={amount}
          onValueChange={setAmount}
          error={errors.amount}
        />{' '}
      </div>
    </Modal>
  );
}
