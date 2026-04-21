'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';

interface MyAssetsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MyAssetsPanel({ isOpen, onClose }: MyAssetsPanelProps) {
  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="My Assets"
      description="Assets currently assigned to you."
      width="w-[480px]"
    >
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
        <p className="text-sm text-gray-400">Asset management is not available yet</p>
      </div>
    </SidePanel>
  );
}
