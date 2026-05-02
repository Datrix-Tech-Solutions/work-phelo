import { Asset, AssetStatus, AssetCondition } from '@/types/asset';
import { AssetTypeIcon } from '@/components/atoms/assetIcons';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<AssetStatus, { dot: string; text: string; bg: string; label: string }> =
  {
    AVAILABLE: {
      dot: 'bg-green-500',
      text: 'text-green-700',
      bg: 'bg-green-50',
      label: 'Available',
    },
    ASSIGNED: { dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', label: 'Assigned' },
    MAINTENANCE: {
      dot: 'bg-yellow-400',
      text: 'text-yellow-700',
      bg: 'bg-yellow-50',
      label: 'Maintenance',
    },
    RETIRED: { dot: 'bg-gray-400', text: 'text-gray-500', bg: 'bg-gray-100', label: 'Retired' },
  };

const CONDITION_STYLES: Record<AssetCondition, { text: string; bg: string; label: string }> = {
  NEW: { text: 'text-green-700', bg: 'bg-green-50', label: 'New' },
  GOOD: { text: 'text-blue-700', bg: 'bg-blue-50', label: 'Good' },
  FAIR: { text: 'text-yellow-700', bg: 'bg-yellow-50', label: 'Fair' },
  POOR: { text: 'text-red-700', bg: 'bg-red-50', label: 'Poor' },
};

function StatusBadge({ status }: { status: AssetStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold shrink-0', s.bg, s.text)}>
      {s.label}
    </span>
  );
}

function AssetCard({
  asset,
  onEdit,
  onAssign,
  onUnassign,
  onTransfer,
  onRetire,
  onDelete,
}: {
  asset: Asset;
  onEdit?: () => void;
  onAssign?: () => void;
  onUnassign?: () => void;
  onTransfer?: () => void;
  onRetire?: () => void;
  onDelete?: () => void;
}) {
  const isAssigned = asset.status === 'ASSIGNED';
  const hasActions = !!(onEdit || onAssign || onUnassign || onTransfer || onRetire || onDelete);

  const formattedPurchaseDate = asset.purchaseDate
    ? new Date(asset.purchaseDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="bg-white border border-gray-200 rounded-card flex flex-col h-full hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      {/* Top row: icon + name/number + status */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="w-10 h-10 rounded-lg bg-[#EEF1F8] flex items-center justify-center shrink-0">
          <AssetTypeIcon type={asset.type} size="sm" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-snug truncate">{asset.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{asset.assetNumber}</p>
        </div>
        <StatusBadge status={asset.status} />
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-gray-100" />

      {/* Detail rows */}
      <div className="flex flex-col gap-2.5 px-4 py-3 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400">Serial</span>
          <span className="text-xs font-mono text-gray-700 truncate max-w-[55%] text-right">
            {asset.serialNumber ?? '—'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400">Condition</span>
          <span className="text-xs font-semibold text-gray-700">
            {asset.condition ? CONDITION_STYLES[asset.condition].label : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400">Purchased</span>
          <span className="text-xs font-semibold text-gray-700">{formattedPurchaseDate}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400">Assigned To</span>
          <span
            className={cn(
              'text-xs font-semibold truncate max-w-[55%] text-right',
              isAssigned ? 'text-blue-600' : 'text-gray-400',
            )}
          >
            {asset.assignedEmployeeName ?? 'Unassigned'}
          </span>
        </div>
      </div>

      {hasActions && (
        <>
          {/* Divider */}
          <div className="mx-4 h-px bg-gray-100" />

          {/* Action buttons */}
          <div className="flex gap-2 p-4 pt-3">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                Edit
              </button>
            )}

            {isAssigned ? (
              <>
                {onUnassign && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnassign();
                    }}
                    className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
                  >
                    Unassign
                  </button>
                )}
                {onTransfer && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTransfer();
                    }}
                    className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                  >
                    Transfer
                  </button>
                )}
              </>
            ) : (
              <>
                {onAssign && asset.status !== 'RETIRED' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAssign();
                    }}
                    className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                  >
                    Assign
                  </button>
                )}
                {onRetire && asset.status !== 'RETIRED' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetire();
                    }}
                    className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-yellow-50 text-yellow-600 hover:bg-yellow-100 transition-colors"
                  >
                    Retire
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AssetCard;
