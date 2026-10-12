'use client';

import { TabBar } from '@/components/molecules/shared/TabBar';
import { useMarketingAccess } from '@/hooks/marketing/useMarketingAccess';

interface Props {
  base: string;
  className?: string;
}

export function CampaignManagementTabs({ base, className }: Props) {
  const tabs = [
    { key: 'domains', label: 'Business Domains', href: `${base}/domains` },
    { key: 'sms-senders', label: 'SMS Senders', href: `${base}/sms-senders` },
  ];

  const { canSeeTab } = useMarketingAccess();
  const visible = tabs.filter((tab) => canSeeTab('campaign-management', tab.key));

  return <TabBar tabs={visible} className={className} />;
}
