'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CircleCheck, Circle } from 'lucide-react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useLinkSourceType, useSourceTypeSetup } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { SOURCE_MODULE_LABELS } from '@/lib/accounting/sourceModules';
import { extractError } from '@/lib/extractError';
import { cn } from '@/lib/utils';
import type { SourceTypeDefinition } from '@/types/accounting';

function Step({
  done,
  title,
  children,
}: {
  done: boolean;
  title: string;
  children?: React.ReactNode;
}) {
  const Icon = done ? CircleCheck : Circle;
  return (
    <div className="flex gap-3">
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', done ? 'text-green-600' : 'text-gray-300')} />
      <div className="flex flex-1 flex-col gap-1.5">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {children}
      </div>
    </div>
  );
}

/**
 * What an accountant has to do before a module can raise transactions in Accounting - and what is
 * still missing. The module's own users see "Accounting not set up" until every step is done.
 */
export function SourceBillingSetup({ sourceType }: { sourceType: SourceTypeDefinition }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const toast = useToast();
  const { data: setup, isLoading, isError } = useSourceTypeSetup(sourceType.id);
  const link = useLinkSourceType();
  const moduleLabel = SOURCE_MODULE_LABELS[sourceType.module];

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (isError || !setup) {
    return <p className="text-sm text-red-500">The set-up could not be loaded.</p>;
  }
  if (!setup.supported) {
    return (
      <p className="text-sm text-gray-500">
        {moduleLabel} does not raise transactions in Accounting, so there is nothing to set up here.
      </p>
    );
  }

  const handleLink = async () => {
    try {
      await link.mutateAsync(sourceType.id);
      toast.success('Source linked.');
    } catch (err) {
      toast.error(extractError(err, 'Failed to link the source'));
    }
  };

  const usable = setup.transactionTypes.filter((t) => t.usable);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {moduleLabel} users can bill their records once every step below is done.
        </p>
        <Badge
          label={setup.ready ? 'READY' : 'NOT READY'}
          variant={setup.ready ? 'success' : 'warning'}
        />
      </div>

      <Step done={setup.linked} title="Link the source">
        {setup.linked ? (
          <p className="text-xs text-gray-500">
            {setup.sourceName} is linked, so transaction types can be linked to it.
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              The source starts unlinked. Link it once you are ready, so transaction types can be
              linked to it.
            </p>
            <div>
              <Button
                size="sm"
                onClick={handleLink}
                isLoading={link.isPending}
                loadingText="Linking…"
              >
                Link source
              </Button>
            </div>
          </>
        )}
      </Step>

      <Step done={!!setup.baseCurrency} title="Set the base currency">
        <p className="text-xs text-gray-500">
          {setup.baseCurrency
            ? `Transactions raised by ${moduleLabel} are in ${setup.baseCurrency}.`
            : 'Transactions raised by other modules are in the base currency. Set it in Accounting configuration.'}
        </p>
      </Step>

      <Step done={usable.length > 0 && setup.entityTypes.length > 0} title="Link transaction types">
        <p className="text-xs text-gray-500">
          Create an entity type for these records — or use one you already have — then link
          receivable transaction types (invoices or direct receipts) to this source and name that
          entity type in each one&apos;s business roles. {moduleLabel} users pick from the entity
          types you name here.
        </p>

        {setup.transactionTypes.length === 0 ? (
          <p className="text-xs font-medium text-amber-600">No transaction type is linked yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {setup.transactionTypes.map((type) => (
              <li
                key={type.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{type.name}</p>
                  {type.problem && <p className="text-xs text-amber-600">{type.problem}</p>}
                </div>
                <Badge
                  label={type.usable ? 'USABLE' : 'NOT USABLE'}
                  variant={type.usable ? 'success' : 'warning'}
                />
              </li>
            ))}
          </ul>
        )}

        {setup.entityTypes.length > 0 && (
          <p className="text-xs text-gray-500">
            Offered to {moduleLabel}: {setup.entityTypes.map((t) => t.name).join(', ')}.
          </p>
        )}

        <div className="flex gap-2">
          <Link href={`/${tenantSlug}/accounting/entities`}>
            <Button size="sm" variant="outline">
              Open entity types
            </Button>
          </Link>
          <Link href={`/${tenantSlug}/accounting/settings/transaction-types`}>
            <Button size="sm" variant="outline">
              Open transaction types
            </Button>
          </Link>
        </div>
      </Step>
    </div>
  );
}
