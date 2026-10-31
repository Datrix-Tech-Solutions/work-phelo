'use client';

import { TabBar } from '@/components/molecules/shared/TabBar';
import { useMarketingAccess } from '@/hooks/marketing/useMarketingAccess';

interface Props {
  base: string;
  className?: string;
}

export function ProspectsTabs({ base, className }: Props) {
  const tabs = [
    { key: 'all', label: 'Prospects', href: `${base}/all` },
    { key: 'clients', label: 'Clients', href: `${base}/clients` },
  ];

  const { canSeeTab } = useMarketingAccess();
  const visible = tabs.filter((tab) => canSeeTab('prospects', tab.key));

  return <TabBar tabs={visible} className={className} />;
}
