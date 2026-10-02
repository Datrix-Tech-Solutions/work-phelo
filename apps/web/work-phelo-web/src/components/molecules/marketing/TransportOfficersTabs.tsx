'use client';

import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  base: string;
  className?: string;
}

export function TransportOfficersTabs({ base, className }: Props) {
  const tabs = [
    { key: 'details', label: 'Officers', href: `${base}/details` },
    { key: 'location', label: 'Location', href: `${base}/location` },
  ];

  return <TabBar tabs={tabs} className={className} />;
}
