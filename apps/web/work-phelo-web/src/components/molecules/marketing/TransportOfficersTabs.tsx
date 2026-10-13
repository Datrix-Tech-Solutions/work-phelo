'use client';

import { TabBar } from '@/components/molecules/shared/TabBar';
import { useMarketingAccess } from '@/hooks/marketing/useMarketingAccess';

interface Props {
  base: string;
  className?: string;
}

export function TransportOfficersTabs({ base, className }: Props) {
  const tabs = [
    { key: 'details', label: 'Officers', href: `${base}/details` },
    { key: 'location', label: 'Location', href: `${base}/location` },
  ];

  const { canSeeTab } = useMarketingAccess();
  const visible = tabs.filter((tab) => canSeeTab('transport-officers', tab.key));

  return <TabBar tabs={visible} className={className} />;
}
