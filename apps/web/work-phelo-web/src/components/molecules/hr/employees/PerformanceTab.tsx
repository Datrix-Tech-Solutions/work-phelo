'use client';

import { useState, type ReactNode } from 'react';
import { ClipboardCheck, Target } from 'lucide-react';
import { cn, cardClass } from '@/lib/utils';

type PerformanceSection = 'objectives' | 'assessments';

const SECTIONS: { key: PerformanceSection; label: string; icon: typeof Target }[] = [
  { key: 'objectives', label: 'Objectives', icon: Target },
  { key: 'assessments', label: 'Assessments', icon: ClipboardCheck },
];

interface Props {
  /** Content for each section; a "coming soon" card is shown when omitted. */
  objectives?: ReactNode;
  assessments?: ReactNode;
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className={cardClass('p-8 text-center text-sm text-gray-400')}>{label} coming soon.</div>
  );
}

export function PerformanceTab({ objectives, assessments }: Props) {
  const [section, setSection] = useState<PerformanceSection>('assessments');

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <div className={cardClass('shrink-0 p-2 flex gap-1 w-full lg:w-56 flex-row lg:flex-col')}>
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            className={cn(
              'flex-1 lg:flex-none flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors',
              section === key
                ? 'bg-(--module-btn-bg,var(--color-brand)) text-white'
                : 'text-gray-600 hover:bg-gray-100',
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 min-w-0 w-full">
        {section === 'objectives'
          ? (objectives ?? <ComingSoon label="Objectives" />)
          : (assessments ?? <ComingSoon label="Assessments" />)}
      </div>
    </div>
  );
}
