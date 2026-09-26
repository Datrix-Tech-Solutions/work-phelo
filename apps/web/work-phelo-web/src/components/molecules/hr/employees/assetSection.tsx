import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { TableButton } from '@/components/atoms/TableButton';
import { AssetCard } from '@/components/molecules/hr/employees/empAssetCard';
import { EmployeeAsset } from '@/types/asset';

interface Props {
  assets: EmployeeAsset[];
  onAssignAsset?: () => void;
  onManage?: () => void;
  onSelectAsset?: (asset: EmployeeAsset) => void;
}

export function AssetsSection({ assets, onAssignAsset, onManage, onSelectAsset }: Props) {
  const headerAction =
    onAssignAsset || onManage ? (
      <div className="flex items-center gap-3">
        {onAssignAsset && (
          <TableButton variant="blue" onClick={onAssignAsset}>
            Assign Asset
          </TableButton>
        )}
        {onManage && (
          <TableButton variant="blue" onClick={onManage}>
            Manage
          </TableButton>
        )}
      </div>
    ) : undefined;

  if (assets.length === 0) {
    return (
      <SectionCard title="Assets" headerAction={headerAction}>
        <div className="py-8 text-center">
          <p className="text-sm text-gray-400">No assets assigned to this employee.</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Assets" scrollX headerAction={headerAction}>
      <div className="flex gap-2 px-3 py-0" style={{ width: 'max-content', minWidth: '100%' }}>
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} onSelect={onSelectAsset} />
        ))}
      </div>
    </SectionCard>
  );
}
