'use client';

import { useState } from 'react';
import { Icons } from '@/components/atoms/icons';

interface CollapsibleOverviewProps {
  title?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}

export function CollapsibleOverview({
  title = 'Overview',
  headerExtra,
  children,
  defaultCollapsed = false,
}: CollapsibleOverviewProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {headerExtra}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label={collapsed ? 'Expand overview' : 'Collapse overview'}
        >
          <Icons.ChevronDown
            className={`w-4 h-4 transition-transform duration-600 ${collapsed ? '-rotate-90' : ''}`}
          />
        </button>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-600 ease-in-out"
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className="overflow-hidden">
          <div className="pt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
