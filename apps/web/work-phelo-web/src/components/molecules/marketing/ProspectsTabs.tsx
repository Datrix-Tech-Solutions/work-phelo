'use client';

import { TabBar } from '@/components/molecules/shared/TabBar';
import { useMarketingAccess } from '@/hooks/marketing/useMarketingAccess';
import { useDueFollowUps } from '@/hooks/marketing/useFollowUps';

interface Props {
  base: string;
  className?: string;
}

export function ProspectsTabs({ base, className }: Props) {
  const { data: dueFollowUps } = useDueFollowUps();
  const tabs = [
    { key: 'all', label: 'All Prospects', href: `${base}/all` },
    {
      key: 'upcoming-reminders',
      label: 'Reminders',
      count: dueFollowUps.length,
      href: `${base}/upcoming-reminders`,
    },
  ];

  const { canSeeTab } = useMarketingAccess();
  const visible = tabs.filter((tab) => canSeeTab('prospects', tab.key));

  return <TabBar tabs={visible} className={className} />;
}
