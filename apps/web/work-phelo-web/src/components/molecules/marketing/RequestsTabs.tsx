'use client';

import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  base: string;
  className?: string;
}

export function RequestsTabs({ base, className }: Props) {
  const tabs = [
    { key: 'all-requests', label: 'All Requests', href: `${base}/all-requests` },
    { key: 'request-history', label: 'Request History', href: `${base}/request-history` },
  ];

  return <TabBar tabs={tabs} className={className} />;
}
