'use client';

import { useState } from 'react';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { CreatableSearchSelect } from '@/components/atoms/CreatableSearchSelect';
import { Icons } from '@/components/atoms/icons';
import { useReinsurers } from '@/hooks';

interface ReinsurerEntry {
  id: string;
  name: string;
  email: string;
}

interface ReinsurerDistributionSelectProps {
  value: ReinsurerEntry[];
  onChange: (entries: ReinsurerEntry[]) => void;
}

export function ReinsurerDistributionSelect({ value, onChange }: ReinsurerDistributionSelectProps) {
  const { data: reinsurers = [] } = useReinsurers();
  const [editingId, setEditingId] = useState<string | null>(null);

  const multiSelectOptions = reinsurers.map((r) => ({ value: r.id, label: r.name }));
  const selectedIds = value.map((e) => e.id);

  const handleSelectionChange = (ids: string[]) => {
    const next: ReinsurerEntry[] = ids.map((id) => {
      const existing = value.find((e) => e.id === id);
      if (existing) return existing;
      const reinsurer = reinsurers.find((r) => r.id === id);
      return { id, name: reinsurer?.name ?? '', email: reinsurer?.email ?? '' };
    });
    onChange(next);
    // clear editing state if that reinsurer was removed
    if (editingId && !ids.includes(editingId)) setEditingId(null);
  };

  const updateEmail = (id: string, email: string) => {
    onChange(value.map((e) => (e.id === id ? { ...e, email } : e)));
  };

  const remove = (id: string) => {
    onChange(value.filter((e) => e.id !== id));
    if (editingId === id) setEditingId(null);
  };

  // Build email suggestions scoped to a specific reinsurer (primary + contacts)
  const getEmailOptions = (id: string) => {
    const r = reinsurers.find((re) => re.id === id);
    if (!r) return [];
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    const add = (email: string | null) => {
      if (email && !seen.has(email)) {
        seen.add(email);
        opts.push({ value: email, label: email });
      }
    };
    add(r.email);
    r.contacts.forEach((c) => add(c.email));
    return opts;
  };

  return (
    <div className="flex flex-col gap-4">
      <MultiSelect
        label="Reinsurers"
        placeholder="Select reinsurers…"
        options={multiSelectOptions}
        value={selectedIds}
        onChange={handleSelectionChange}
        hideChips
      />

      {value.length > 0 && (
        <div className="flex flex-col gap-2">
          {value.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex flex-col gap-2"
            >
              {/* Name row */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-900">{entry.name}</span>
                <button
                  type="button"
                  onClick={() => remove(entry.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                >
                  <Icons.X className="w-4 h-4" />
                </button>
              </div>

              {/* Email row */}
              {editingId === entry.id ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <CreatableSearchSelect
                      placeholder="Enter or select email…"
                      options={getEmailOptions(entry.id)}
                      value={entry.email}
                      onChange={(v) => updateEmail(entry.id, v)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="shrink-0 text-xs font-medium text-brand hover:text-brand/80 transition-colors px-2 py-1"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 truncate">
                    {entry.email || <span className="italic text-gray-300">No email</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingId(entry.id)}
                    className="shrink-0 text-xs font-medium text-brand hover:text-brand/80 transition-colors"
                  >
                    Change email
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
