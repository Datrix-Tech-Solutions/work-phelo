'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { FilterSelect } from '@/components/molecules/shared/FilterSelect';
import { AddAssetPanel } from '@/components/organisms/assets/AddAssetPanel';
import { EditAssetPanel } from '@/components/organisms/assets/EditAssetPanel';
import { AssignAssetPanel } from '@/components/organisms/assets/AssignAssetPanel';
import { TransferAssetPanel } from '@/components/organisms/assets/TransferAssetPanel';
import { RetireAssetModal } from '@/components/organisms/assets/RetireAssetModal';
import { DeleteAssetModal } from '@/components/organisms/assets/DeleteAssetModal';
import { Modal } from '@/components/organisms/shared/Modal';
import AssetCard from '@/components/molecules/AssetCard';
import { AssetType } from '@/components/atoms/assetIcons';
import { Asset, CreateAssetPayload, UpdateAssetPayload } from '@/types/asset';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';
import {
  useAssets,
  useCreateAsset,
  useDeleteAsset,
  useAssignAsset,
  useRetireAsset,
  useUnassignAsset,
  useUpdateAsset,
} from '@/hooks/useAssets';
import { useEmployees } from '@/hooks/hr/useEmployees';
import { useToast } from '@/hooks/useToast';
import { Package, UserCheck, CheckCircle, Wrench, Archive } from 'lucide-react';
import { StatCard } from '@/components/molecules/dashboard/StatCard';

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

type PanelState =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'edit'; asset: Asset }
  | { type: 'assign'; asset: Asset }
  | { type: 'unassign'; asset: Asset }
  | { type: 'transfer'; asset: Asset }
  | { type: 'retire'; asset: Asset }
  | { type: 'delete'; asset: Asset };

type AssetForm = {
  name: string;
  type: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCost?: string;
  currency: string;
  condition?: string;
  notes?: string;
};

export function AssetsContent() {
  const canCreateAsset = usePermission(Permission.MANAGE_ASSETS);
  const canUpdateAsset = usePermission(Permission.MANAGE_ASSETS);
  const canAssignAsset = usePermission(Permission.ASSIGN_ASSET);
  const toast = useToast();
  const { data: assets = [], isLoading } = useAssets();

  const summary = useMemo(
    () => ({
      total: assets.length,
      assigned: assets.filter((a) => a.status === 'ASSIGNED').length,
      available: assets.filter((a) => a.status === 'AVAILABLE').length,
      maintenance: assets.filter((a) => a.status === 'MAINTENANCE').length,
      retired: assets.filter((a) => a.status === 'RETIRED').length,
    }),
    [assets],
  );
  const { data: employeesResult } = useEmployees({ limit: 200 });
  const employees = (employeesResult?.data ?? []).filter((employee) =>
    ['ACTIVE', 'PROBATION'].includes(employee.employmentStatus),
  );
  const { mutate: createAsset } = useCreateAsset();
  const { mutate: updateAsset } = useUpdateAsset();
  const { mutate: assignAsset } = useAssignAsset();
  const { mutate: unassignAsset } = useUnassignAsset();
  const { mutate: retireAsset, isPending: isRetiringAsset } = useRetireAsset();
  const { mutate: deleteAsset, isPending: isDeletingAsset } = useDeleteAsset();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [panel, setPanel] = useState<PanelState>({ type: 'none' });

  const closePanel = () => setPanel({ type: 'none' });

  const normalizeAssetForm = (data: AssetForm): CreateAssetPayload => {
    const payload: CreateAssetPayload = {
      name: data.name.trim(),
      type: data.type as AssetType,
      currency: data.currency?.trim() || 'GHS',
    };

    if (data.serialNumber?.trim()) {
      payload.serialNumber = data.serialNumber.trim();
    }

    if (data.purchaseDate) {
      payload.purchaseDate = data.purchaseDate;
    }

    if (data.purchaseCost?.trim()) {
      payload.purchaseCost = Number(data.purchaseCost);
    }

    if (data.condition) {
      payload.condition = data.condition as NonNullable<UpdateAssetPayload['condition']>;
    }

    if (data.notes?.trim()) {
      payload.notes = data.notes.trim();
    }

    return payload;
  };

  const filtered = useMemo(() => {
    return assets.filter((asset) => {
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
  }, [assets, search, statusFilter, typeFilter, conditionFilter]);

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

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-3 shrink-0">
        <StatCard
          title="Total Assets"
          value={summary.total}
          icon={<Package className="w-4.5 h-4.5 text-gray-600" />}
          iconBg="bg-gray-100"
        />
        <StatCard
          title="Assigned"
          value={summary.assigned}
          icon={<UserCheck className="w-4.5 h-4.5 text-blue-600" />}
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Available"
          value={summary.available}
          icon={<CheckCircle className="w-4.5 h-4.5 text-green-600" />}
          iconBg="bg-green-50"
        />
        <StatCard
          title="Under Maintenance"
          value={summary.maintenance}
          icon={<Wrench className="w-4.5 h-4.5 text-yellow-600" />}
          iconBg="bg-yellow-50"
        />
        <StatCard
          title="Retired"
          value={summary.retired}
          icon={<Archive className="w-4.5 h-4.5 text-red-500" />}
          iconBg="bg-red-50"
        />
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

      {isLoading ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
          <p className="text-sm font-medium text-gray-900">Loading assets...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
          <p className="text-sm font-medium text-gray-900">No assets found</p>
          <p className="text-xs text-gray-400">
            {hasFilters ? 'Try adjusting your filters' : 'Add your first asset to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto items-start">
          {filtered.map((asset) => (
            <div key={asset.id}>
              <AssetCard
                asset={asset}
                onEdit={canUpdateAsset ? () => setPanel({ type: 'edit', asset }) : undefined}
                onAssign={canAssignAsset ? () => setPanel({ type: 'assign', asset }) : undefined}
                onUnassign={
                  canAssignAsset ? () => setPanel({ type: 'unassign', asset }) : undefined
                }
                onTransfer={
                  canAssignAsset ? () => setPanel({ type: 'transfer', asset }) : undefined
                }
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
          createAsset(normalizeAssetForm(data), {
            onSuccess: () => {
              toast.success('Asset created successfully');
              closePanel();
            },
            onError: () => {
              toast.error('Failed to create asset');
            },
          });
        }}
      />

      <EditAssetPanel
        isOpen={panel.type === 'edit'}
        onClose={closePanel}
        asset={panel.type === 'edit' ? panel.asset : null}
        onSubmit={(assetId, data) => {
          updateAsset(
            { id: assetId, ...normalizeAssetForm(data) },
            {
              onSuccess: () => {
                toast.success('Asset updated successfully');
                closePanel();
              },
              onError: () => {
                toast.error('Failed to update asset');
              },
            },
          );
        }}
      />

      <AssignAssetPanel
        isOpen={panel.type === 'assign'}
        onClose={closePanel}
        asset={panel.type === 'assign' ? panel.asset : null}
        employees={employees}
        onAssign={(assetId, employeeId) => {
          assignAsset(
            { assetId, employeeId },
            {
              onSuccess: () => {
                toast.success('Asset assigned successfully');
                closePanel();
              },
              onError: () => {
                toast.error('Failed to assign asset');
              },
            },
          );
        }}
      />

      <TransferAssetPanel
        isOpen={panel.type === 'transfer'}
        onClose={closePanel}
        asset={panel.type === 'transfer' ? panel.asset : null}
        employees={employees}
        onTransfer={(assetId, employeeId) => {
          assignAsset(
            { assetId, employeeId },
            {
              onSuccess: () => {
                toast.success('Asset transferred successfully');
                closePanel();
              },
              onError: () => {
                toast.error('Failed to transfer asset');
              },
            },
          );
        }}
      />

      <RetireAssetModal
        isOpen={panel.type === 'retire'}
        onClose={closePanel}
        asset={panel.type === 'retire' ? panel.asset : null}
        isLoading={isRetiringAsset}
        onConfirm={(assetId) => {
          retireAsset(assetId, {
            onSuccess: () => {
              toast.success('Asset retired successfully');
              closePanel();
            },
            onError: () => {
              toast.error('Failed to retire asset');
            },
          });
        }}
      />

      <DeleteAssetModal
        isOpen={panel.type === 'delete'}
        onClose={closePanel}
        asset={panel.type === 'delete' ? panel.asset : null}
        isLoading={isDeletingAsset}
        onConfirm={(assetId) => {
          deleteAsset(assetId, {
            onSuccess: () => {
              toast.success('Asset deleted successfully');
              closePanel();
            },
            onError: () => {
              toast.error('Failed to delete asset');
            },
          });
        }}
      />

      <Modal
        isOpen={panel.type === 'unassign'}
        onClose={closePanel}
        title="Unassign Asset"
        description={
          panel.type === 'unassign'
            ? `Are you sure you want to unassign "${panel.asset.name}" from ${panel.asset.assignedEmployeeName ?? 'the current employee'}?`
            : ''
        }
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={closePanel}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (panel.type !== 'unassign') return;
                unassignAsset(panel.asset.id, {
                  onSuccess: () => {
                    toast.success('Asset unassigned successfully');
                    closePanel();
                  },
                  onError: () => {
                    toast.error('Failed to unassign asset');
                  },
                });
              }}
            >
              Unassign
            </Button>
          </div>
        }
      />
    </>
  );
}
