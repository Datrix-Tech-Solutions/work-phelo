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
    { key: 'all', label: 'Prospects', count: dueFollowUps.length, href: `${base}/all` },
    { key: 'clients', label: 'Clients', href: `${base}/clients` },
  ];

  const { canSeeTab } = useMarketingAccess();
  const visible = tabs.filter((tab) => canSeeTab('prospects', tab.key));

  return <TabBar tabs={visible} className={className} />;
}
