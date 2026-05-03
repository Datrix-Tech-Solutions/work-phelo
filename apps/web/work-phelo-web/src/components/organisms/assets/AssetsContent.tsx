'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { FilterSelect } from '@/components/molecules/shared/FilterSelect';
import { AddAssetPanel } from '@/components/organisms/assets/AddAssetPanel';
import { EditAssetPanel } from '@/components/organisms/assets/EditAssetPanel';
import { AssignAssetPanel } from '@/components/organisms/assets/AssignAssetPanel';
import { RetireAssetModal } from '@/components/organisms/assets/RetireAssetModal';
import { DeleteAssetModal } from '@/components/organisms/assets/DeleteAssetModal';
import AssetCard from '@/components/molecules/AssetCard';
import { AssetType } from '@/components/atoms/assetIcons';
import { Asset } from '@/types/asset';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';

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

// TODO: replace with useAssets() hook when endpoint is ready
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

// TODO: replace with useEmployees() hook when wiring up assign
const DUMMY_EMPLOYEES = [
  { id: 'e1', firstName: 'Kwame', lastName: 'Asante', jobTitle: 'Software Engineer' },
  { id: 'e2', firstName: 'Ama', lastName: 'Boateng', jobTitle: 'Product Manager' },
];

interface Props {
  tenantSlug: string;
}

type PanelState =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'edit'; asset: Asset }
  | { type: 'assign'; asset: Asset }
  | { type: 'retire'; asset: Asset }
  | { type: 'delete'; asset: Asset };

export function AssetsContent({ tenantSlug }: Props) {
  const router = useRouter();
  const canCreateAsset = usePermission(Permission.MANAGE_ASSETS);
  const canUpdateAsset = usePermission(Permission.MANAGE_ASSETS);
  const canAssignAsset = usePermission(Permission.ASSIGN_ASSET);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [panel, setPanel] = useState<PanelState>({ type: 'none' });

  const closePanel = () => setPanel({ type: 'none' });

  const filtered = useMemo(() => {
    return DUMMY_ASSETS.filter((asset) => {
      if (statusFilter && asset.status !== statusFilter) return false;
      if (typeFilter && asset.type !== typeFilter) return false;
      if (conditionFilter && asset.condition !== conditionFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const match =
          asset.name.toLowerCase().includes(q) ||
          asset.serialNumber?.toLowerCase().includes(q) ||
          TYPE_LABELS[asset.type].toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [search, statusFilter, typeFilter, conditionFilter]);

  const hasFilters = !!(search || statusFilter || typeFilter || conditionFilter);

  return (
    <>
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Assets</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {filtered.length} asset{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreateAsset && <Button onClick={() => setPanel({ type: 'add' })}>+ Add Asset</Button>}
      </div>

      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, serial number, type..."
            className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-input text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
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
        {hasFilters && (
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

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
          <p className="text-sm font-medium text-gray-900">No assets found</p>
          <p className="text-xs text-gray-400">
            {hasFilters ? 'Try adjusting your filters' : 'Add your first asset to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto items-start">
          {filtered.map((asset) => (
            <div
              key={asset.id}
              onClick={() => router.push(`/${tenantSlug}/hr/assets/${asset.id}`)}
              className="cursor-pointer"
            >
              <AssetCard
                asset={asset}
                onEdit={canUpdateAsset ? () => setPanel({ type: 'edit', asset }) : undefined}
                onAssign={canAssignAsset ? () => setPanel({ type: 'assign', asset }) : undefined}
                onUnassign={canAssignAsset ? () => setPanel({ type: 'assign', asset }) : undefined}
                onTransfer={canAssignAsset ? () => setPanel({ type: 'assign', asset }) : undefined}
                onRetire={canUpdateAsset ? () => setPanel({ type: 'retire', asset }) : undefined}
                onDelete={canUpdateAsset ? () => setPanel({ type: 'delete', asset }) : undefined}
              />
            </div>
          ))}
        </div>
      )}

      {/* Retire button lives in detail page; expose it here via card context menu if needed */}

      <AddAssetPanel
        isOpen={panel.type === 'add'}
        onClose={closePanel}
        onSubmit={(data) => {
          // TODO: POST /hr/assets
          console.log('Create asset:', data);
          closePanel();
        }}
      />

      <EditAssetPanel
        isOpen={panel.type === 'edit'}
        onClose={closePanel}
        asset={panel.type === 'edit' ? panel.asset : null}
        onSubmit={(assetId, data) => {
          // TODO: PATCH /hr/assets/:id
          console.log('Edit asset:', assetId, data);
          closePanel();
        }}
      />

      <AssignAssetPanel
        isOpen={panel.type === 'assign'}
        onClose={closePanel}
        asset={panel.type === 'assign' ? panel.asset : null}
        employees={DUMMY_EMPLOYEES}
        onAssign={(assetId, employeeId) => {
          // TODO: POST /hr/assets/:id/assign
          console.log('Assign asset:', assetId, 'to employee:', employeeId);
          closePanel();
        }}
      />

      <RetireAssetModal
        isOpen={panel.type === 'retire'}
        onClose={closePanel}
        asset={panel.type === 'retire' ? panel.asset : null}
        onConfirm={(assetId) => {
          // TODO: PATCH /hr/assets/:id/retire
          console.log('Retire asset:', assetId);
          closePanel();
        }}
      />

      <DeleteAssetModal
        isOpen={panel.type === 'delete'}
        onClose={closePanel}
        asset={panel.type === 'delete' ? panel.asset : null}
        onConfirm={(assetId) => {
          // TODO: DELETE /hr/assets/:id
          console.log('Delete asset:', assetId);
          closePanel();
        }}
      />
    </>
  );
}
