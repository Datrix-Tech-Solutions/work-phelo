'use client';

import { useState } from 'react';
import { SearchSelect } from '@/components/atoms/SearchSelect';

export default function TransportOfficerLocationPage() {
  const [officer, setOfficer] = useState('');

  return (
    <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden bg-white">
      {/* SearchSelect pinned to top-right of the map area */}
      <div className="absolute top-4 right-4 z-10 w-72">
        <SearchSelect
          size="sm"
          placeholder="Search transport officer..."
          options={[]}
          value={officer}
          onChange={setOfficer}
        />
      </div>
    </div>
  );
}
