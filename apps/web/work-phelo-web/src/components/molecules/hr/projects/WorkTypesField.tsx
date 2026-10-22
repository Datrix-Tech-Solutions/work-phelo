'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { InlineRenameText } from '@/components/atoms/InlineRenameText';
import { WorkTypeIconPicker } from '@/components/atoms/WorkTypeIconPicker';
import { inputClass } from '@/lib/utils';
import { ProjectWorkType, WorkTypeIcon } from '@/types/hr';

interface Props {
  label: string;
  value: ProjectWorkType[];
  onChange: (value: ProjectWorkType[]) => void;
  placeholder?: string;
  error?: string;
}

/** Pick an icon, name the work type, press Add (or Enter), and it is listed below in a row with its icon. */
export function WorkTypesField({ label, value, onChange, placeholder, error }: Props) {
  const [draft, setDraft] = useState('');
  const [icon, setIcon] = useState<WorkTypeIcon>('TASK');
  const [draftError, setDraftError] = useState('');

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    if (value.some((w) => w.name.toLowerCase() === name.toLowerCase())) {
      setDraftError(`"${name}" is already in the list`);
      return;
    }
    onChange([...value, { name, icon }]);
    setDraft('');
    setIcon('TASK');
    setDraftError('');
  };

  const shownError = draftError || error;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-bold text-gray-900">{label}</label>
      <div className="flex items-start gap-2">
        <WorkTypeIconPicker value={icon} onChange={setIcon} />
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
        <ul className="flex flex-wrap items-center gap-2">
          {value.map((w, i) => (
            <li
              key={i}
              className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg pl-2 pr-1.5 py-1.5"
            >
              <WorkTypeIconPicker
                inline
                value={w.icon}
                onChange={(next) =>
                  onChange(value.map((x, j) => (j === i ? { ...x, icon: next } : x)))
                }
              />
              <InlineRenameText
                value={w.name}
                takenNames={value.map((x) => x.name)}
                onRename={(name) => onChange(value.map((x, j) => (j === i ? { ...x, name } : x)))}
                onTaken={(name) => setDraftError(`"${name}" is already in the list`)}
                className="text-gray-900"
              />
              <button
                type="button"
                aria-label={`Remove ${w.name}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="p-0.5 text-gray-400 hover:text-red-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
