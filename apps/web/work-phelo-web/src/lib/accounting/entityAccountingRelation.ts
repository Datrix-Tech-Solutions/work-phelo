import {
  AccountingTradeSide,
  EntityAccountingRelation,
  EntityType,
  SubledgerAccount,
} from '@/types/accounting';

export type EntityAccountingRelationChipColor =
  | 'red'
  | 'green'
  | 'blue'
  | 'purple'
  | 'amber'
  | 'teal'
  | 'gray';

export const ENTITY_ACCOUNTING_RELATION_CHIP_COLOR: Record<
  EntityAccountingRelation,
  EntityAccountingRelationChipColor
> = {
  RECEIVABLE: 'green',
  PAYABLE: 'red',
  BOTH: 'purple',
  NONE: 'gray',
};

// entity.type is the tenant's own Entity Type name, uppercased — match directly rather
// than translating through the old fixed SubledgerType label set, so a custom type (not
// just Customer/Vendor/etc.) resolves correctly too.
export function resolveEntityAccountingRelation(
  entity: Pick<SubledgerAccount, 'type'>,
  entityTypes: EntityType[] | undefined,
): EntityAccountingRelation {
  const match = entityTypes?.find(
    (t) => t.name.trim().toUpperCase() === entity.type.trim().toUpperCase(),
  );
  return match?.accountingRelation ?? 'NONE';
}

export function matchesTradeSide(
  relation: EntityAccountingRelation,
  side: AccountingTradeSide,
): boolean {
  return relation === side || relation === 'BOTH';
}
