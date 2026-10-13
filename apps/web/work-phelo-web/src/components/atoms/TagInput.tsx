'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { inputClass } from '@/lib/utils';

interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  error?: string;
}

/** Free-text multi-value field: type a value, then press Enter to list it below as a chip. */
export function TagInput({
  value,
  onChange,
  placeholder = 'Type and press Enter',
  error,
}: TagInputProps) {
  const [draft, setDraft] = useState('');

  function commit(raw: string) {
    const tag = raw.trim();
    setDraft('');
    if (!tag) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commit(draft);
            }
          }}
          className={inputClass(error)}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => onChange(value.filter((v) => v !== tag))}
                className="text-gray-400 hover:text-gray-900 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
