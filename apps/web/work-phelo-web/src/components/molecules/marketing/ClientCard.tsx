'use client';

import { ContactCard } from '@/components/molecules/ContactCard';
import { formatMoney } from '@/lib/formatMoney';
import type { ClientListItem } from '@/types/marketing';

export function ClientCard({ client, onClick }: { client: ClientListItem; onClick?: () => void }) {
  const contact = client.primaryContact;
  const purchased = client.products.filter((p) => p.status === 'PURCHASED').length;

  return (
    <ContactCard
      name={client.companyName}
      subtitle={client.businessType?.name}
      statusChip={
        client.isBillable
          ? { label: 'Billable', color: 'green' }
          : { label: 'Non-billable', color: 'gray' }
      }
      details={[
        {
          label: 'Products',
          value:
            client.products.length === 0
              ? '—'
              : `${client.products.length} (${purchased} purchased)`,
        },
        { label: 'Achieved Revenue', value: formatMoney(client.achievedRevenue) },
      ]}
      contactPerson={contact?.name}
      email={contact?.email ?? '—'}
      phone={contact?.phone ?? '—'}
      address={client.locationLabel}
      onClick={onClick}
    />
  );
}
