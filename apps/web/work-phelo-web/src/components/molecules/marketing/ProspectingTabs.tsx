'use client';

import { TabBar } from '@/components/molecules/shared/TabBar';
import { useMarketingAccess } from '@/hooks/marketing/useMarketingAccess';

interface Props {
  base: string;
  className?: string;
}

export function ProspectingTabs({ base, className }: Props) {
  const tabs = [
    { key: 'sales-pipeline', label: 'Sales Pipeline', href: `${base}/sales-pipeline` },
    { key: 'product', label: 'Product/Service', href: `${base}/product` },
    { key: 'decision-maker', label: 'Decision Maker', href: `${base}/decision-maker` },
    { key: 'source-type', label: 'Source Type', href: `${base}/source-type` },
    { key: 'interaction-medium', label: 'Follow-up Medium', href: `${base}/interaction-medium` },
    {
      key: 'business-type',
      label: 'Business Type',
      href: `${base}/business-type`,
    },
    { key: 'reminders', label: 'Reminders', href: `${base}/reminders` },
  ];

  const { canSeeTab } = useMarketingAccess();
  const visible = tabs.filter((tab) => canSeeTab('settings', tab.key));

  return <TabBar tabs={visible} className={className} />;
}
