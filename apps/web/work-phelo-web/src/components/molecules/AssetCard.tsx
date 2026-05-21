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

function ShortcutButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  className: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={cn('flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors', className)}
    >
      {label}
    </button>
  );
}

function AssetCard({
  asset,
  onView,
  onEdit,
  onAssign,
  onUnassign,
  onTransfer,
}: {
  asset: Asset;
  onView?: () => void;
  onEdit?: () => void;
  onAssign?: () => void;
  onUnassign?: () => void;
  onTransfer?: () => void;
}) {
  const isAssigned = asset.status === 'ASSIGNED';

  const formattedPurchaseDate = asset.purchaseDate
    ? new Date(asset.purchaseDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  const shortcuts: React.ReactNode[] = [];

  if (onEdit) {
    shortcuts.push(
      <ShortcutButton
        key="edit"
        label="Edit"
        onClick={() => onEdit()}
        className="bg-blue-50 text-blue-600 hover:bg-blue-100"
      />,
    );
  }

  if (isAssigned) {
    if (onUnassign) {
      shortcuts.push(
        <ShortcutButton
          key="unassign"
          label="Unassign"
          onClick={() => onUnassign()}
          className="bg-orange-50 text-orange-600 hover:bg-orange-100"
        />,
      );
    }
    if (onTransfer) {
      shortcuts.push(
        <ShortcutButton
          key="transfer"
          label="Transfer"
          onClick={() => onTransfer()}
          className="bg-purple-50 text-purple-600 hover:bg-purple-100"
        />,
      );
    }
  } else if (asset.status === 'AVAILABLE' && onAssign) {
    shortcuts.push(
      <ShortcutButton
        key="assign"
        label="Assign"
        onClick={() => onAssign()}
        className="bg-green-50 text-green-600 hover:bg-green-100"
      />,
    );
  }

  return (
    <div
      onClick={onView}
      className={cn(
        'bg-white border border-gray-200 rounded-card flex flex-col h-full transition-all duration-200',
        onView ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : '',
      )}
    >
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
          <span className="text-xs text-gray-400">
            {asset.type === 'VEHICLE' ? 'Reg. No.' : 'Serial'}
          </span>
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

      {shortcuts.length > 0 && (
        <>
          {/* Divider */}
          <div className="mx-4 h-px bg-gray-100" />

          {/* Shortcut buttons */}
          <div className="flex gap-2 p-4 pt-3">{shortcuts}</div>
        </>
      )}
    </div>
  );
}

export default AssetCard;
