import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { Badge } from '@/components/atoms/Badge';
import { TypeChip } from '@/components/atoms/TypeChip';
import { SUBLEDGER_TYPE_LABELS, SubledgerAccount } from '@/types/accounting';
import {
  SUBLEDGER_TYPE_CHIP_COLOR,
  type SubledgerTypeChipColor,
} from '@/lib/accounting/subledgerType';

const FALLBACK_CHIP_COLOR: SubledgerTypeChipColor = 'gray';

function fmtBalance(amount: number, currency: string) {
  const value = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${value}`;
}

interface EntityOverviewProps {
  entity: SubledgerAccount;
}

export function EntityOverview({ entity }: EntityOverviewProps) {
  return (
    <CollapsibleOverview>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField label="Entity Name" value={entity.name} />
        <DetailField label="Entity ID" value={entity.code} />
        <DetailField
          label="Type"
          value={
            <TypeChip
              label={
                (SUBLEDGER_TYPE_LABELS as Record<string, string>)[entity.type] ?? entity.type
              }
              color={
                (SUBLEDGER_TYPE_CHIP_COLOR as Record<string, SubledgerTypeChipColor>)[
                  entity.type
                ] ?? FALLBACK_CHIP_COLOR
              }
            />
          }
        />
        <DetailField
          label="Status"
          value={
            <Badge
              label={entity.status === 'ACTIVE' ? 'Active' : 'Inactive'}
              variant={entity.status === 'ACTIVE' ? 'success' : 'neutral'}
            />
          }
        />
        <DetailField
          label="Outstanding Balance"
          value={fmtBalance(entity.balance.baseBalance, entity.currency ?? '')}
        />
        {entity.contactName && <DetailField label="Contact" value={entity.contactName} />}
        {entity.address && <DetailField label="Address" value={entity.address} />}
        {entity.externalRef && (
          <DetailField label="External Reference" value={entity.externalRef} />
        )}
      </div>
    </CollapsibleOverview>
  );
}
