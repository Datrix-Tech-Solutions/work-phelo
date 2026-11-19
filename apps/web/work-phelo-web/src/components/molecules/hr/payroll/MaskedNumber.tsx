'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { maskNumber } from '@/lib/payrollDisplay';

/** An ID number shown hidden, with an eye beside it to reveal or hide just that one. */
export function MaskedNumber({ value }: { value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-sm text-gray-700">{shown ? value : maskNumber(value)}</span>
      <button
        type="button"
        aria-label={shown ? 'Hide number' : 'Show number'}
        onClick={(e) => {
          e.stopPropagation();
          setShown((v) => !v);
        }}
        className="text-gray-400 hover:text-gray-700"
      >
        {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </span>
  );
}
