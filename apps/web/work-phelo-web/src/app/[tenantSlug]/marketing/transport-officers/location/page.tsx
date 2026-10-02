'use client';

import { useMemo, useState } from 'react';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  TransportOfficerMap,
  OfficerLocation,
} from '@/components/organisms/marketing/TransportOfficerMap';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';

const OFFICERS: OfficerLocation[] = [];

export default function TransportOfficerLocationPage() {
  const [officer, setOfficer] = useState('');

  const options = useMemo(
    () => OFFICERS.map((o) => ({ value: o.id, label: o.name, sublabel: o.status })),
    [],
  );

  return (
    <div className={cn(pageContent, 'flex-1 min-h-0 flex flex-col')}>
      <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden bg-white">
        {/* SearchSelect pinned to top-right of the map area */}
        <div className="absolute top-4 right-4 z-10 w-72 bg-white rounded-input shadow-md">
          <SearchSelect
            size="sm"
            placeholder="Search transport officer..."
            options={options}
            value={officer}
            onChange={setOfficer}
          />
        </div>

        <TransportOfficerMap officers={OFFICERS} selectedOfficerId={officer || undefined} />
      </div>
    </div>
  );
}
