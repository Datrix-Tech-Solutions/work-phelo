'use client';

import { Building2, MapPin, Package, Phone, UserRound } from 'lucide-react';
import { DataCard, DataCardDetail } from '@/components/organisms/shared/DataCard';
import { frostedAvatarStyle } from '@/lib/utils';
import type { ClientListItem } from '@/types/marketing';

function detail(Icon: typeof Package, label: string, value: string): DataCardDetail {
  return {
    label: (
      <>
        <Icon className="w-3 h-3" /> {label}
      </>
    ),
    value: (
      <span className="text-xs font-semibold text-gray-700 truncate max-w-40 text-right">
        {value}
      </span>
    ),
  };
}

export function ClientCard({ client, onClick }: { client: ClientListItem; onClick?: () => void }) {
  const contact = client.primaryContact;
  const purchased = client.products.filter((p) => p.status === 'PURCHASED').length;

  return (
    <DataCard
      surface="card"
      onClick={onClick}
      icon={
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/30 text-white"
          style={frostedAvatarStyle('#8b5cf6')}
        >
          <Building2 className="h-5 w-5" />
        </div>
      }
      title={client.companyName}
      subtitle={client.businessType?.name}
      badge={
        client.isBillable ? (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-600">
            Billable
          </span>
        ) : undefined
      }
      details={[
        detail(UserRound, 'Contact', contact?.name ?? '—'),
        detail(Phone, 'Phone', contact?.phone ?? '—'),
        detail(MapPin, 'Location', client.locationLabel),
        detail(
          Package,
          'Products',
          client.products.length === 0 ? '—' : `${client.products.length} (${purchased} purchased)`,
        ),
      ]}
    />
  );
}
