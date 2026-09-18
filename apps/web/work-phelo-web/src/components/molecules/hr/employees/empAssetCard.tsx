import { AssetTypeIcon } from '@/components/atoms/assetIcons';
import { EmployeeAsset } from '@/types/asset';

export function AssetCard({
  asset,
  onSelect,
}: {
  asset: EmployeeAsset;
  onSelect?: (asset: EmployeeAsset) => void;
}) {
  const assignedDate = new Date(asset.assignedAt).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const condition = asset.condition
    ? asset.condition.charAt(0) + asset.condition.slice(1).toLowerCase()
    : null;

  return (
    <div
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect ? () => onSelect(asset) : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(asset);
              }
            }
          : undefined
      }
      className={`w-52 shrink-0 bg-gray-50 border border-gray-200 rounded-2xl p-3 flex flex-col gap-2 ${
        onSelect
          ? 'group cursor-pointer transition-all duration-150 hover:border-brand hover:bg-brand-tint hover:ring-2 hover:ring-brand/30 hover:shadow-xl hover:-translate-y-1 hover:scale-[1.03] focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20'
          : ''
      }`}
    >
      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
        <AssetTypeIcon type={asset.type} size="sm" className="text-gray-600" />
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-bold text-gray-900 leading-snug">{asset.name}</p>
        {asset.serialNumber && <p className="text-xs text-gray-500">S/N: {asset.serialNumber}</p>}
      </div>

      <div className="border-t border-gray-200 pt-3 grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-gray-400">Assigned On</p>
          <p className="text-xs font-semibold text-gray-900">{assignedDate}</p>
        </div>
        {condition && (
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-gray-400">Asset Condition</p>
            <p className="text-xs font-semibold text-gray-900">{condition}</p>
          </div>
        )}
      </div>
    </div>
  );
}
