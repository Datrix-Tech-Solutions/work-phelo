'use client';

import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  base: string;
  className?: string;
}

export function TransportOfficersTabs({ base, className }: Props) {
  const tabs = [
    { key: 'location', label: 'Location', href: `${base}/location` },
    { key: 'details', label: 'Details', href: `${base}/details` },
  ];

  return <TabBar tabs={tabs} className={className} />;
}
