import { AssetTypeIcon, AssetType } from '@/lib/assetIcons';

interface EmployeeAsset {
  id: string;
  name: string;
  type: AssetType;
  assignedAt: string;
}

export function AssetCard({ asset }: { asset: EmployeeAsset }) {
  const formattedDate = new Date(asset.assignedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="w-52 shrink-0 border border-gray-200 rounded-2xl overflow-hidden bg-white hover:shadow-md transition-all duration-200 group">
      {/* Icon Area */}
      <div className="h-36 bg-[#EEF1F8] flex items-center justify-center relative">
        <AssetTypeIcon
          type={asset.type}
          size="md"
          className="text-[#0D2244] group-hover:scale-110 transition-transform duration-300"
        />
      </div>

      {/* Content Area */}
      <div className="px-4 py-4 flex flex-col">
        <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 min-h-10">
          {asset.name}
        </p>

        <div className="mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">Assigned on {formattedDate}</span>
        </div>
      </div>
    </div>
  );
}
