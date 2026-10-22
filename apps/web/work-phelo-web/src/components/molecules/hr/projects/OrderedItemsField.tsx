'use client';

import { useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { inputClass } from '@/lib/utils';

interface Props {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  error?: string;
}

/** Ordered list field (workflow steps): type an item, press Add (or Enter), and it is listed below in a row, where it can be reordered or removed. */
export function OrderedItemsField({ label, value, onChange, placeholder, error }: Props) {
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState('');

  const add = () => {
    const step = draft.trim();
    if (!step) return;
    if (value.some((v) => v.toLowerCase() === step.toLowerCase())) {
      setDraftError(`"${step}" is already in the list`);
      return;
    }
    onChange([...value, step]);
    setDraft('');
    setDraftError('');
  };

  const move = (from: number, to: number) => {
    const next = [...value];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };

  const shownError = draftError || error;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-bold text-gray-900">{label}</label>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={draft}
            placeholder={placeholder}
            onChange={(e) => {
              setDraft(e.target.value);
              setDraftError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            className={inputClass(shownError)}
          />
        </div>
        <Button variant="outline" onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
      {shownError && <p className="text-xs text-red-500">{shownError}</p>}

      {value.length > 0 && (
        <ol className="flex flex-wrap items-center gap-y-2">
          {value.map((step, i) => (
            <li key={step} className="flex items-center">
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg pl-2 pr-1.5 py-1.5">
                <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded bg-brand-tint text-brand text-[11px] font-bold">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-gray-900">{step}</span>
                <button
                  type="button"
                  aria-label={`Move ${step} earlier`}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className="p-0.5 text-gray-400 hover:text-gray-900 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${step} later`}
                  disabled={i === value.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="p-0.5 text-gray-400 hover:text-gray-900 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${step}`}
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  className="p-0.5 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {i < value.length - 1 && (
                <ArrowRight className="w-4 h-4 mx-1.5 text-gray-300 shrink-0" />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
