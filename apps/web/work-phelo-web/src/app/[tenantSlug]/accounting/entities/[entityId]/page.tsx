'use client';

import { use } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { EntityOverview } from '@/components/molecules/accounting/EntityOverview';
import { TransactionsTable } from '@/components/organisms/accounting/tables/TransactionsTable';
import { useSubledger } from '@/hooks';

export default function EntityDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; entityId: string }>;
}) {
  const { tenantSlug, entityId } = use(params);

  const { data: entity, isLoading } = useSubledger(entityId);
  const base = `/${tenantSlug}/accounting/entities`;

  return (
    <div className="flex flex-col gap-6 py-6 pr-6 pl-(--page-pl) min-h-0 overflow-y-auto flex-1">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Entities
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <span className="text-gray-700 font-medium">{entity?.name ?? '—'}</span>
      </nav>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
      ) : !entity ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          Entity not found.
        </div>
      ) : (
        <>
          <EntityOverview entity={entity} />
          <TransactionsTable partyId={entity.id} />
        </>
      )}
    </div>
  );
}
