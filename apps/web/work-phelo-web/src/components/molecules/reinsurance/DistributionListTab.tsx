'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { CreateDistributionPanel } from '@/components/organisms/reinsurance/panels/CreateDistributionPanel';

interface DistributionListTabProps {
  facOffer: number;
  placedPct?: number;
}

export function DistributionListTab({ facOffer, placedPct = 0 }: DistributionListTabProps) {
  const [panelOpen, setPanelOpen] = useState(false);

  const availablePct = Math.max(0, facOffer - placedPct);
  const progress = facOffer > 0 ? (placedPct / facOffer) * 100 : 0;

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-gray-900">Placement Share Breakdown</h3>
            <p className="text-xs text-gray-400">
              Distributed offers of the Fac. Offer{' '}
              <span className="font-semibold text-gray-600">{facOffer}%</span>
            </p>
          </div>

          <Button size="sm" onClick={() => setPanelOpen(true)}>
            Create Distribution List
          </Button>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500">
            <span>Placed Capacity</span>
            <span>
              <span className="text-gray-700">{availablePct}%</span>
              <span className="text-gray-400"> / {facOffer}%</span>
            </span>
          </div>
          <ProgressBar value={progress} showLabel={false} />
        </div>
      </div>

      <CreateDistributionPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
