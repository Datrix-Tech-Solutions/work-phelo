'use client';

import { TabBar } from '@/components/molecules/shared/TabBar';
import { useMarketingAccess } from '@/hooks/marketing/useMarketingAccess';

interface Props {
  base: string;
  className?: string;
}

export function RequestsTabs({ base, className }: Props) {
  const tabs = [
    { key: 'all-requests', label: 'All Requests', href: `${base}/all-requests` },
    { key: 'request-history', label: 'Request History', href: `${base}/request-history` },
  ];

  const { canSeeTab } = useMarketingAccess();
  const visible = tabs.filter((tab) => canSeeTab('requests', tab.key));

  return <TabBar tabs={visible} className={className} />;
}
