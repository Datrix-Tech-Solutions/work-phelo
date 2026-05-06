import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { AssetCard } from '@/components/molecules/employees/empAssetCard';
import { EmployeeAsset } from '@/types/asset';

interface Props {
  assets: EmployeeAsset[];
}

export function AssetsSection({ assets }: Props) {
  if (assets.length === 0) {
    return (
      <SectionCard title="Assets">
        <div className="py-8 text-center">
          <p className="text-sm text-gray-400">No assets assigned to this employee.</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Assets" scrollX>
      <div className="flex gap-2 px-3 py-0" style={{ width: 'max-content', minWidth: '100%' }}>
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
      </div>
    </SectionCard>
  );
}
