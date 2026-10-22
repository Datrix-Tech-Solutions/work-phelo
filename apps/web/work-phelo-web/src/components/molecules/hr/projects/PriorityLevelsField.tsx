'use client';

import { useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { PRIORITY_COLORS, PRIORITY_COLOR_OPTIONS, PriorityDot } from '@/lib/priorityColors';
import { inputClass } from '@/lib/utils';
import { PriorityColor, PriorityLevel } from '@/types/hr';

interface Props {
  label: string;
  value: PriorityLevel[];
  onChange: (value: PriorityLevel[]) => void;
  placeholder?: string;
  error?: string;
}

/** Ordered levels of importance, lowest to highest: pick a colour, name the level, press Add. */
export function PriorityLevelsField({ label, value, onChange, placeholder, error }: Props) {
  const [draft, setDraft] = useState('');
  const [color, setColor] = useState<PriorityColor>('GRAY');
  const [draftError, setDraftError] = useState('');

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    if (value.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setDraftError(`"${name}" is already in the list`);
      return;
    }
    onChange([...value, { name, color }]);
    setDraft('');
    setColor('GRAY');
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
      <label className="text-sm font-bold text-gray-900">
        {label} <span className="text-gray-400 font-normal">(lowest to highest)</span>
      </label>
      <div className="flex items-start gap-2">
        <div className="w-44 shrink-0">
          <SearchSelect
            placeholder="Colour"
            options={PRIORITY_COLOR_OPTIONS}
            value={color}
            onChange={(v) => v && setColor(v as PriorityColor)}
            clearable={false}
          />
        </div>
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
          {value.map((p, i) => (
            <li key={p.name} className="flex items-center">
              <div
                className={`flex items-center gap-1.5 rounded-lg pl-2.5 pr-1.5 py-1.5 ${PRIORITY_COLORS[p.color].chip}`}
              >
                <PriorityDot color={p.color} />
                <span className="text-sm font-medium">{p.name}</span>
                <button
                  type="button"
                  aria-label={`Move ${p.name} lower`}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className="p-0.5 opacity-60 hover:opacity-100 disabled:opacity-20 transition-opacity"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${p.name} higher`}
                  disabled={i === value.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="p-0.5 opacity-60 hover:opacity-100 disabled:opacity-20 transition-opacity"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  className="p-0.5 opacity-60 hover:opacity-100 transition-opacity"
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
