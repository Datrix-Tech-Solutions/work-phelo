'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';

interface AvailableAsset {
  id: string;
  name: string;
  type: string;
  condition: string;
  assetNumber: string;
}

interface AssignAssetPanelProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  availableAssets: AvailableAsset[];
  onAssign: (assetId: string) => void;
}

export function AssignAssetPanel({
  isOpen,
  onClose,
  employeeName,
  availableAssets,
  onAssign,
}: AssignAssetPanelProps) {
  const [assetSearch, setAssetSearch] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const filteredAvailableAssets = assetSearch.trim()
    ? availableAssets.filter(
        (a) =>
          a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
          a.assetNumber.toLowerCase().includes(assetSearch.toLowerCase()),
      )
    : [];

  const selectedAsset = availableAssets.find((a) => a.id === selectedAssetId) ?? null;

  const ASSET_TYPE_LABELS: Record<string, string> = {
    LAPTOP: 'Laptop',
    PHONE: 'Phone',
    MONITOR: 'Monitor',
    PRINTER: 'Printer',
    VEHICLE: 'Vehicle',
    FURNITURE: 'Furniture',
    SOFTWARE_LICENSE: 'Software License',
    OTHER: 'Other',
  };

  const CONDITION_LABELS: Record<string, { label: string; text: string; bg: string }> = {
    NEW: { label: 'New', text: 'text-green-700', bg: 'bg-green-50' },
    GOOD: { label: 'Good', text: 'text-blue-700', bg: 'bg-blue-50' },
    FAIR: { label: 'Fair', text: 'text-yellow-700', bg: 'bg-yellow-50' },
    POOR: { label: 'Poor', text: 'text-red-700', bg: 'bg-red-50' },
  };

  const handleClose = () => {
    setAssetSearch('');
    setSelectedAssetId(null);
    onClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Assign Asset"
      description={`Assign an available asset to ${employeeName}.`}
      width="w-[480px]"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            disabled={!selectedAssetId}
            onClick={() => {
              if (selectedAssetId) {
                onAssign(selectedAssetId);
                handleClose();
              }
            }}
          >
            Assign
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Search */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-gray-900">Search Asset</label>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={assetSearch}
              onChange={(e) => {
                setAssetSearch(e.target.value);
                setSelectedAssetId(null);
              }}
              placeholder="Search by name or asset number…"
              className="w-full h-10 pl-9 pr-4 border border-gray-300 rounded-input text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-[#0D2244]/20 focus:border-[#0D2244]"
            />
          </div>
        </div>

        {/* Results */}
        {assetSearch.trim() && (
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
            {filteredAvailableAssets.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No available assets found</p>
            ) : (
              filteredAvailableAssets.map((asset) => {
                const isSelected = selectedAssetId === asset.id;
                const cond = CONDITION_LABELS[asset.condition] || CONDITION_LABELS.GOOD;

                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedAssetId(isSelected ? null : asset.id)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-card border transition-all ${
                      isSelected
                        ? 'border-[#0D2244] bg-[#EEF1F8] ring-1 ring-[#0D2244]/20'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{asset.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{asset.assetNumber}</p>
                    </div>
                    <span className="text-xs font-medium text-gray-500 shrink-0">
                      {ASSET_TYPE_LABELS[asset.type] || asset.type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${cond.bg} ${cond.text}`}
                    >
                      {cond.label}
                    </span>
                    {isSelected && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#0D2244"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Selected summary */}
        {selectedAsset && (
          <div className="flex items-center gap-2 px-4 py-3 bg-[#EEF1F8] rounded-card border border-[#0D2244]/20">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0D2244"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <p className="text-sm text-[#0D2244] font-semibold truncate">
              {selectedAsset.name} selected
            </p>
          </div>
        )}
      </div>
    </SidePanel>
  );
}
