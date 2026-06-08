'use client';

import { useState } from 'react';
import { DetailField } from '@/components/atoms/DetailField';
import { Icons } from '@/components/atoms/icons';
import { Counterparty } from '@/types/reinsurance';
import { codeToCountry } from '@/lib/geo';

function formatTerritory(addresses: Counterparty['addresses']): string {
  const primary = addresses.find((a) => a.isPrimary) ?? addresses[0];
  if (!primary) return '—';
  const country = codeToCountry(primary.country);
  return primary.state ? `${primary.state}, ${country}` : country;
}

interface CedantOverviewProps {
  cedant: Counterparty;
}

export function CedantOverview({ cedant }: CedantOverviewProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Overview</h2>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label={collapsed ? 'Expand overview' : 'Collapse overview'}
        >
          <Icons.ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
          />
        </button>
      </div>

      {!collapsed && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
          <DetailField label="Name" value={cedant.name} />
          <DetailField label="Email" value={cedant.email ?? '—'} />
          <DetailField label="Phone" value={cedant.phone ?? '—'} />
          <DetailField label="Territory" value={formatTerritory(cedant.addresses)} />
          {cedant.notes && <DetailField label="Notes" value={cedant.notes} />}
        </div>
      )}
    </div>
  );
}
