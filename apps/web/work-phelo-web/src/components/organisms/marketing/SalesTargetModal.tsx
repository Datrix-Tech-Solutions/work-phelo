'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Input } from '@/components/atoms/Input';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useProspectingSettings } from '@/hooks/marketing/useProspectingSettings';
import { useTargetReps } from '@/hooks/marketing/useSalesTargets';
import { formatDateRange } from '@/lib/formatters';
import type { CreateSalesTargetPayload, SalesTarget } from '@/types/marketing';

interface Props {
  /** The target being edited; only its amount can change. Omit to create one. */
  editing: SalesTarget | null;
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: (payload: CreateSalesTargetPayload) => void;
  onUpdate: (id: string, amount: number) => void;
}

type Errors = Partial<Record<'userId' | 'startDate' | 'endDate' | 'amount', string>>;

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

  const [userId, setUserId] = useState('');
  const [productId, setProductId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [amount, setAmount] = useState(editing ? String(Number(editing.amount)) : '');
  const [errors, setErrors] = useState<Errors>({});

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
      if (!userId) next.userId = 'Choose a sales rep';
      if (!startDate) next.startDate = 'Choose a start date';
      if (!endDate) next.endDate = 'Choose an end date';
      else if (startDate && endDate < startDate)
        next.endDate = 'End date cannot be before the start';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const rounded = Math.round(value * 100) / 100;
    if (editing) onUpdate(editing.id, rounded);
    else {
      onCreate({
        userId,
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
          ? `${editing.userName ?? 'Sales rep'} · ${editing.productName ?? 'All products'} · ${formatDateRange(editing.startDate, editing.endDate)}`
          : 'Set what a sales rep should bring in. Achieved revenue is the money received from their billable clients in the period.'
      }
      width="max-w-lg"
      height="max-h-[90vh]"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} isLoading={isSubmitting}>
            {editing ? 'Save Changes' : 'Create Target'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!editing && (
          <>
            <SearchSelect
              label="Sales Rep"
              placeholder={loadingReps ? 'Loading...' : 'Choose a sales rep'}
              options={repOptions}
              value={userId}
              onChange={(v) => setUserId(v)}
              error={errors.userId}
              disabled={loadingReps}
            />
            <SearchSelect
              label="Product (optional)"
              placeholder={loadingProducts ? 'Loading...' : 'All products'}
              options={productOptions}
              value={productId}
              onChange={(v) => setProductId(v)}
              disabled={loadingProducts}
              clearable
            />
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
        <Input
          label="Target Amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
        />
      </div>
    </Modal>
  );
}
