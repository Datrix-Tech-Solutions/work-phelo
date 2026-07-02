'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { SidePanel } from '@/components/organisms/shared/SidePanel';

interface AddEndorsementReinsurerPanelProps {
  isOpen: boolean;
  isSaving: boolean;
  remainingPercent: number;
  reinsurerOptions: SearchSelectOption[];
  onClose: () => void;
  onAdd: (counterpartyId: string, offeredPercent: number) => Promise<void>;
}

export function AddEndorsementReinsurerPanel({
  isOpen,
  isSaving,
  remainingPercent,
  reinsurerOptions,
  onClose,
  onAdd,
}: AddEndorsementReinsurerPanelProps) {
  const [counterpartyId, setCounterpartyId] = useState('');
  const [offeredPercent, setOfferedPercent] = useState(String(remainingPercent));
  const numericOfferedPercent = Number(offeredPercent);
  const offeredPercentError =
    !Number.isFinite(numericOfferedPercent) || numericOfferedPercent <= 0
      ? 'Enter an offered capacity greater than 0%.'
      : numericOfferedPercent > remainingPercent
        ? `Offered capacity cannot exceed the remaining ${remainingPercent}%.`
        : undefined;

  const handleAdd = async () => {
    if (!counterpartyId || offeredPercentError) return;
    await onAdd(counterpartyId, numericOfferedPercent);
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Add Reinsurer"
      description="Offer the remaining endorsement capacity to a new reinsurer."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            isLoading={isSaving}
            disabled={!counterpartyId || !!offeredPercentError}
          >
            Offer Capacity
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-medium text-blue-700">Remaining endorsement capacity</p>
          <p className="mt-1 text-xl font-semibold text-blue-900">{remainingPercent}%</p>
        </div>

        <SearchSelect
          label="Reinsurer"
          placeholder="Select a reinsurer"
          options={reinsurerOptions}
          value={counterpartyId}
          onChange={setCounterpartyId}
        />

        <Input
          label="Offered Capacity (%)"
          type="number"
          min={0.0001}
          max={remainingPercent}
          step="0.0001"
          value={offeredPercent}
          onChange={(event) => setOfferedPercent(event.target.value)}
          error={offeredPercentError}
        />

        {reinsurerOptions.length === 0 && (
          <p className="text-sm text-amber-700">
            All active reinsurers are already involved in this placement or endorsement.
          </p>
        )}
      </div>
    </SidePanel>
  );
}
