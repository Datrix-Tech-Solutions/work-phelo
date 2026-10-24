'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { NumberField } from '@/components/atoms/NumberField';
import { inputClass } from '@/lib/utils';
import { PricingDraft, expectedValue, expectedValueNote, formatMoney } from '@/lib/projectPricing';
import type { ProjectBillingType } from '@/types/hr';

interface Props {
  type: ProjectBillingType;
  value: PricingDraft;
  onChange: (value: PricingDraft) => void;
  startDate?: string;
  endDate?: string;
  error?: string;
}

/** The price fields for a billing type, and the expected value they add up to. */
export function ProjectPricingFields({ type, value, onChange, startDate, endDate, error }: Props) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [due, setDue] = useState('');

  const addMilestone = () => {
    const trimmed = name.trim();
    if (!trimmed || amount <= 0) return;
    onChange({
      ...value,
      milestones: [
        ...value.milestones,
        { id: crypto.randomUUID(), name: trimmed, amount, dueDate: due || undefined },
      ],
    });
    setName('');
    setAmount(0);
    setDue('');
  };

  const total = expectedValue(type, value, startDate, endDate);

  return (
    <div className="flex flex-col gap-3">
      {type === 'FLAT_RATE' && (
        <NumberField
          label="Price (GHS)"
          value={value.price}
          onChange={(price) => onChange({ ...value, price })}
        />
      )}

      {type === 'TIMED' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField
            label="Rate per Hour (GHS)"
            value={value.hourlyRate}
            onChange={(hourlyRate) => onChange({ ...value, hourlyRate })}
          />
          <NumberField
            label="Estimated Hours"
            decimals={0}
            value={value.estimatedHours}
            onChange={(estimatedHours) => onChange({ ...value, estimatedHours })}
          />
        </div>
      )}

      {type === 'RETAINER' && (
        <NumberField
          label="Amount per Month (GHS)"
          value={value.monthlyAmount}
          onChange={(monthlyAmount) => onChange({ ...value, monthlyAmount })}
        />
      )}

      {type === 'MILESTONE' && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-gray-900">Milestones</label>
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_auto] gap-2 items-start">
            <input
              type="text"
              value={name}
              placeholder="e.g. Design sign-off"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addMilestone();
                }
              }}
              className={inputClass()}
            />
            <NumberField
              ariaLabel="Milestone amount"
              className="w-full py-2"
              value={amount}
              onChange={setAmount}
            />
            <DatePicker size="sm" value={due} onChange={setDue} placeholder="Due (optional)" />
            <Button variant="outline" onClick={addMilestone} disabled={!name.trim() || amount <= 0}>
              Add
            </Button>
          </div>
          {value.milestones.length > 0 && (
            <ol className="flex flex-col gap-1">
              {value.milestones.map((m, i) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                >
                  <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded bg-brand-tint text-brand text-[11px] font-bold">
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0 truncate font-medium text-gray-900">
                    {m.name}
                  </span>
                  <span className="tabular-nums text-gray-700">{formatMoney(m.amount)}</span>
                  <span className="w-20 text-right text-xs text-gray-400">
                    {m.dueDate
                      ? new Date(m.dueDate).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })
                      : ''}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${m.name}`}
                    onClick={() =>
                      onChange({
                        ...value,
                        milestones: value.milestones.filter((x) => x.id !== m.id),
                      })
                    }
                    className="p-0.5 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <p className="text-sm text-gray-600">
        Expected value:{' '}
        <span className="font-bold text-gray-900">{total === null ? '—' : formatMoney(total)}</span>{' '}
        <span className="text-gray-400">
          ({expectedValueNote(type, value, startDate, endDate)})
        </span>
      </p>
    </div>
  );
}
