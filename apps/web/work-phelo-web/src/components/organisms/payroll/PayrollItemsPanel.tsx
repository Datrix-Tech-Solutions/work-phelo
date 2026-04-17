'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { inputClass } from '@/lib/utils';
import type { AllowanceItem } from '@/lib/payrollCalculations';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  type: 'allowance' | 'deduction';
  employeeName: string;
  items: AllowanceItem[];
  onSave: (items: AllowanceItem[]) => void;
}

const EMPTY_ITEM = (): AllowanceItem & { _key: number } => ({
  _key: Date.now(),
  name: '',
  amount: 0,
});

type DraftItem = AllowanceItem & { _key: number };

/* ── Inner form — remounted via key each time the panel opens ── */
function PayrollItemsForm({ onClose, type, employeeName, items, onSave }: Omit<Props, 'isOpen'>) {
  const [draft, setDraft] = useState<DraftItem[]>(
    items.length > 0 ? items.map((i, idx) => ({ ...i, _key: idx })) : [EMPTY_ITEM()],
  );

  const label = type === 'allowance' ? 'Allowance' : 'Deduction';

  const update = (key: number, field: keyof AllowanceItem, value: string | number) => {
    setDraft((prev) => prev.map((d) => (d._key === key ? { ...d, [field]: value } : d)));
  };

  const remove = (key: number) => {
    setDraft((prev) => {
      const next = prev.filter((d) => d._key !== key);
      return next.length > 0 ? next : [EMPTY_ITEM()];
    });
  };

  const handleSave = () => {
    const valid = draft.filter((d) => d.name.trim() && d.amount > 0);
    onSave(valid);
    onClose();
  };

  const total = draft.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={`Edit ${label}s`}
      description={employeeName}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save {label}s</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {draft.map((item) => (
          <div key={item._key} className="flex items-center gap-2">
            <input
              type="text"
              placeholder={`${label} name`}
              value={item.name}
              onChange={(e) => update(item._key, 'name', e.target.value)}
              className={inputClass(undefined, 'flex-1')}
            />
            <input
              type="number"
              placeholder="0.00"
              value={item.amount || ''}
              onChange={(e) => update(item._key, 'amount', Number(e.target.value))}
              className={inputClass(undefined, 'w-28')}
            />
            <button
              onClick={() => remove(item._key)}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        <button
          onClick={() => setDraft((prev) => [...prev, EMPTY_ITEM()])}
          className="flex items-center gap-2 text-sm text-brand hover:text-brand/80 transition-colors py-1"
        >
          <Plus className="w-4 h-4" />
          Add {label}
        </button>
      </div>

      {total > 0 && (
        <div className="flex justify-between items-center px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
          <span className="text-sm font-medium text-gray-600">Total {label}s</span>
          <span className="text-sm font-semibold text-gray-900">GHS {total.toLocaleString()}</span>
        </div>
      )}
    </SidePanel>
  );
}

/* ── Public wrapper ── */
export function PayrollItemsPanel({ isOpen, ...props }: Props) {
  if (!isOpen) {
    return (
      <SidePanel isOpen={false} onClose={props.onClose} title="">
        {null}
      </SidePanel>
    );
  }

  return (
    <PayrollItemsForm
      key={`${props.type}-${props.employeeName}-${props.items.length}`}
      {...props}
    />
  );
}
