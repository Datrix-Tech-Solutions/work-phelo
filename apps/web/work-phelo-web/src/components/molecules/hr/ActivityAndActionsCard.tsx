'use client';

import { useState } from 'react';
import { HeaderTab } from '@/components/molecules/shared/HeaderTab';
import { usePendingActions } from '@/hooks/hr/useEmployeeDashboard';
import { cardClass, cn } from '@/lib/utils';
import { PendingActionsList, pendingActionsTotal } from './PendingActionsList';
import { RecentActivityList } from './RecentActivityList';

type Tab = 'activity' | 'pending';

interface ActivityAndActionsCardProps {
  className?: string;
}

/** Recent activity and pending actions share one card, switched by tabs. Pending actions is
 * the default since it is what HR has to act on; its count shows on the tab so it stays
 * visible while Recent activity is open. */
export function ActivityAndActionsCard({ className }: ActivityAndActionsCardProps) {
  const [tab, setTab] = useState<Tab>('pending');
  const { data: pending } = usePendingActions();
  const pendingTotal = pendingActionsTotal(pending);

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-3 h-72', 'glass'), className)}>
      <div className="flex items-center gap-4 border-b border-gray-200">
        <HeaderTab active={tab === 'pending'} onClick={() => setTab('pending')}>
          Pending Actions
          {pendingTotal > 0 && (
            <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
              {pendingTotal}
            </span>
          )}
        </HeaderTab>
        <HeaderTab active={tab === 'activity'} onClick={() => setTab('activity')}>
          Recent Activity
        </HeaderTab>
      </div>

      {tab === 'pending' ? <PendingActionsList /> : <RecentActivityList />}
    </div>
  );
}
