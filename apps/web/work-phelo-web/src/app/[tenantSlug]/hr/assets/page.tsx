// ASSETS PAGE //

'use client';

import { useState, use, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { SidePanel } from '@/components/organisms/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import AssetCard from '@/components/molecules/AssetCard';
import { AssetType } from '@/lib/assetIcons';

/* ── Types ── */

export type AssetStatus = 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'RETIRED';
export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR';

export interface Asset {
  id: string;
  assetNumber: string;
  name: string;
  type: AssetType;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  currency?: string;
  condition?: AssetCondition;
  notes?: string;
  status: AssetStatus;
  assignedTo?: string;
  assignedEmployeeName?: string;
  assignedAt?: string;
}

interface AssetForm {
  name: string;
  type: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCost?: string;
  currency: string;
  condition?: string;
  notes?: string;
}

/* ── Dummy data ── */
const DUMMY_ASSETS: Asset[] = [
  {
    id: '1',
    assetNumber: 'PHN-0002',
    name: 'iPhone 15 Pro',
    type: 'PHONE',
    serialNumber: 'F4GT9XXXXXAB',
    purchaseDate: '2024-01-20',
    purchaseCost: 3200,
    currency: 'GHS',
    condition: 'NEW',
    status: 'AVAILABLE',
  },
];

/* ── Label maps ── */
const TYPE_LABELS: Record<AssetType, string> = {
  LAPTOP: 'Laptop',
  PHONE: 'Phone',
  TABLET: 'Tablet',
  PRINTER: 'Printer',
  MONITOR: 'Monitor',
  VEHICLE: 'Vehicle',
  FURNITURE: 'Furniture',
  SOFTWARE_LICENSE: 'Software License',
  OTHER: 'Other',
};

/* ── Filter select ── */
function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 px-3 border border-gray-200 rounded-input text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D2244]/20 focus:border-[#0D2244]"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ── Page ── */
export default function AssetsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug: _tenantSlug } = use(params);
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);

  /* ── Form ── */
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<AssetForm>({
    defaultValues: { currency: 'GHS' },
  });

  const typeValue = useWatch({ control, name: 'type' });
  const conditionValue = useWatch({ control, name: 'condition' });
  const purchaseDateValue = useWatch({ control, name: 'purchaseDate' });
  const purchaseCostValue = useWatch({ control, name: 'purchaseCost' });
  const currencyValue = useWatch({ control, name: 'currency' });

  /* ── Client-side filtering ── */
  const filtered = useMemo(() => {
    return DUMMY_ASSETS.filter((asset) => {
      if (statusFilter && asset.status !== statusFilter) return false;
      if (typeFilter && asset.type !== typeFilter) return false;
      if (conditionFilter && asset.condition !== conditionFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchName = asset.name.toLowerCase().includes(q);
        const matchSerial = asset.serialNumber?.toLowerCase().includes(q) ?? false;
        const matchType = TYPE_LABELS[asset.type].toLowerCase().includes(q);
        if (!matchName && !matchSerial && !matchType) return false;
      }
      return true;
    });
  }, [search, statusFilter, typeFilter, conditionFilter]);

  const onSubmit = (data: AssetForm) => {
    // TODO: wire to POST /hr/assets when backend is ready
    console.log('Create asset:', data);
    reset({ currency: 'GHS' });
    setPanelOpen(false);
  };

  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Assets</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {`${filtered.length} asset${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={() => setPanelOpen(true)}>+ Add Asset</Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-52">
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, serial number, type..."
            className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-input text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D2244]/20 focus:border-[#0D2244]"
          />
        </div>

        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          placeholder="All Statuses"
          options={[
            { value: 'AVAILABLE', label: 'Available' },
            { value: 'ASSIGNED', label: 'Assigned' },
            { value: 'MAINTENANCE', label: 'Maintenance' },
            { value: 'RETIRED', label: 'Retired' },
          ]}
        />

        <FilterSelect
          value={typeFilter}
          onChange={setTypeFilter}
          placeholder="All Types"
          options={[
            { value: 'LAPTOP', label: 'Laptop' },
            { value: 'PHONE', label: 'Phone' },
            { value: 'PRINTER', label: 'Printer' },
            { value: 'MONITOR', label: 'Monitor' },
            { value: 'VEHICLE', label: 'Vehicle' },
            { value: 'FURNITURE', label: 'Furniture' },
            { value: 'SOFTWARE_LICENSE', label: 'Software License' },
            { value: 'OTHER', label: 'Other' },
          ]}
        />

        <FilterSelect
          value={conditionFilter}
          onChange={setConditionFilter}
          placeholder="All Conditions"
          options={[
            { value: 'NEW', label: 'New' },
            { value: 'GOOD', label: 'Good' },
            { value: 'FAIR', label: 'Fair' },
            { value: 'POOR', label: 'Poor' },
          ]}
        />

        {(search || statusFilter || typeFilter || conditionFilter) && (
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('');
              setTypeFilter('');
              setConditionFilter('');
            }}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
          <div className="w-14 h-14 rounded-card bg-gray-100 flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900">No assets found</p>
          <p className="text-xs text-gray-400">
            {search || statusFilter || typeFilter || conditionFilter
              ? 'Try adjusting your filters'
              : 'Add your first asset to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto items-start">
          {filtered.map((asset) => (
            <div
              key={asset.id}
              onClick={() => router.push(`/${_tenantSlug}/hr/assets/${asset.id}`)}
              className="cursor-pointer"
            >
              <AssetCard
                asset={asset}
                onEdit={() => console.log('edit', asset.id)}
                onAssign={() => console.log('assign', asset.id)}
                onUnassign={() => console.log('unassign', asset.id)}
                onTransfer={() => console.log('transfer', asset.id)}
                onDelete={() => console.log('delete', asset.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Add Asset side panel ── */}
      <SidePanel
        isOpen={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          reset({ currency: 'GHS' });
        }}
        title="Add Asset"
        description="Register a new asset in the system."
        width="w-[500px]"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setPanelOpen(false);
                reset({ currency: 'GHS' });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)}>Add Asset</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Asset Details
          </p>

          <FormField
            label="Asset Name"
            registration={register('name', { required: 'Required' })}
            error={errors.name}
            placeholder="eg; MacBook Pro 14-inch"
          />

          <SearchSelect
            label="Asset Type"
            placeholder="Select type"
            value={typeValue}
            onChange={(v) => setValue('type', v)}
            options={[
              { value: 'LAPTOP', label: 'Laptop' },
              { value: 'PHONE', label: 'Phone' },
              { value: 'PRINTER', label: 'Printer' },
              { value: 'MONITOR', label: 'Monitor' },
              { value: 'VEHICLE', label: 'Vehicle' },
              { value: 'FURNITURE', label: 'Furniture' },
              { value: 'SOFTWARE_LICENSE', label: 'Software License' },
              { value: 'OTHER', label: 'Other' },
            ]}
          />

          <FormField
            label="Serial Number"
            registration={register('serialNumber')}
            placeholder="eg; C02XL0LFJGH5"
          />

          <DatePicker
            label="Purchase Date"
            value={purchaseDateValue}
            onChange={(v) => setValue('purchaseDate', v)}
            disableFuture
          />

          <CurrencyInput
            label="Purchase Cost"
            value={purchaseCostValue}
            currency={currencyValue}
            onValueChange={(v) => setValue('purchaseCost', v)}
            onCurrencyChange={(v) => setValue('currency', v)}
            placeholder="0.00"
          />

          <SearchSelect
            label="Condition"
            placeholder="Select condition"
            value={conditionValue}
            onChange={(v) => setValue('condition', v)}
            options={[
              { value: 'NEW', label: 'New' },
              { value: 'GOOD', label: 'Good' },
              { value: 'FAIR', label: 'Fair' },
              { value: 'POOR', label: 'Poor' },
            ]}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-900">Notes</label>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Any additional notes about this asset…"
              className="w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-[#0D2244]/20 focus:border-[#0D2244] resize-none"
            />
          </div>
        </div>
      </SidePanel>
    </div>
  );
}
