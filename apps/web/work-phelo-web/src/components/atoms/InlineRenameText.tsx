'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  /** Called with the trimmed new name when it is not empty and not taken. */
  onRename: (name: string) => void;
  /** Names already used by the other items, so a rename can't create a duplicate. */
  takenNames: string[];
  /** Called when the new name is already taken. */
  onTaken?: (name: string) => void;
  className?: string;
}

/** A name that turns into a text box when clicked. Enter or leaving the box saves it; Escape cancels. */
export function InlineRenameText({ value, onRename, takenNames, onTaken, className }: Props) {
  const [text, setText] = useState<string | null>(null);

  const commit = () => {
    if (text === null) return;
    const name = text.trim();
    if (name && name !== value) {
      if (takenNames.some((n) => n.toLowerCase() === name.toLowerCase())) onTaken?.(name);
      else onRename(name);
    }
    setText(null);
  };

  if (text === null) {
    return (
      <button
        type="button"
        title="Click to rename"
        onClick={() => setText(value)}
        className={cn('text-sm font-medium cursor-text hover:underline', className)}
      >
        {value}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={text}
      aria-label={`Rename ${value}`}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          setText(null);
        }
      }}
      size={Math.max(text.length, 4)}
      className="text-sm font-medium text-gray-900 bg-white border border-brand rounded px-1 outline-none"
    />
  );
}
