'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeftRight, BookOpen, UserPlus } from 'lucide-react';
import {
  QuickActionEntry,
  QuickActionTiles,
} from '@/components/molecules/marketing/QuickActionTiles';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';

type Action = 'transaction' | 'journal' | 'entity';

/** Where each action goes, under the tenant's accounting module. */
const PATHS: Record<Action, string> = {
  // These two pages open their form when they arrive with ?new=1.
  transaction: 'transactions?new=1',
  journal: 'journalentry/new',
  entity: 'entities?new=1',
};

/** The accounting dashboard's shortcuts: add a transaction, add a journal, create an entity. */
export function QuickActionsCard({
  className,
  fillCell = false,
}: {
  className?: string;
  /** On wide screens, fill the grid cell instead of adding to its height. */
  fillCell?: boolean;
}) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();

  const entries = useMemo<QuickActionEntry<Action>[]>(
    () => [
      {
        key: 'transaction',
        label: 'Add Transaction',
        icon: ArrowLeftRight,
        color: '#2a78d6',
        allowed: true,
      },
      { key: 'journal', label: 'Add Journal', icon: BookOpen, color: '#1baf7a', allowed: true },
      { key: 'entity', label: 'Create Entity', icon: UserPlus, color: '#7c3aed', allowed: true },
    ],
    [],
  );

  return (
    <QuickActionTiles
      storageKey="accounting-quick-actions-usage"
      entries={entries}
      onSelect={(key) => router.push(`/${tenantSlug}/accounting/${PATHS[key]}`)}
      className={className}
      fillCell={fillCell}
    />
  );
}
