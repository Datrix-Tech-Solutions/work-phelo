'use client';

import { TabBar } from '@/components/molecules/shared/TabBar';
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
      key: 'upcoming-follow-ups',
      label: 'Upcoming Follow Ups',
      count: dueFollowUps.length,
      href: `${base}/upcoming-follow-ups`,
    },
  ];

  return <TabBar tabs={tabs} className={className} />;
}
