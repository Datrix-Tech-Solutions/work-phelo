'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import {
  ReinsurerDistributionSelect,
  ReinsurerEntry,
} from '@/components/molecules/reinsurance/ReinsurerDistributionSelect';

interface CreateDistributionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (entries: ReinsurerEntry[]) => void;
  existingIds?: string[];
}

export function CreateDistributionPanel({
  isOpen,
  onClose,
  onAdd,
  existingIds = [],
}: CreateDistributionPanelProps) {
  const [entries, setEntries] = useState<ReinsurerEntry[]>([]);

  const handleClose = () => {
    setEntries([]);
    onClose();
  };

  const handleAdd = () => {
    if (entries.length > 0) onAdd(entries);
    handleClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add to Distribution List"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={entries.length === 0}>
            Add {entries.length > 0 ? `(${entries.length})` : ''}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <ReinsurerDistributionSelect
          value={entries}
          onChange={setEntries}
          excludeIds={existingIds}
        />
      </div>
    </SidePanel>
  );
}
