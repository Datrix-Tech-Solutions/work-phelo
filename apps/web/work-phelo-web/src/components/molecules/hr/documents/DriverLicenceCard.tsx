'use client';

import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { DriverLicenceModal } from '@/components/organisms/hr/documents/DriverLicenceModal';
import { useDriverLicence, type DriverLicenceScope } from '@/hooks/hr/useDriverLicence';
import { formatDate } from '@/lib/formatters';
import { cardClass } from '@/lib/utils';
import type { DriverLicenceView } from '@/types/hr';

function statusBadge(view: DriverLicenceView) {
  const days = view.daysLeft ?? 0;
  switch (view.status) {
    case 'VALID':
      return { label: 'Valid', variant: 'success' as const };
    case 'EXPIRING':
      return {
        label: days === 0 ? 'Expires today' : `Expires in ${days} day${days === 1 ? '' : 's'}`,
        variant: 'warning' as const,
      };
    case 'EXPIRED':
      return { label: 'Expired', variant: 'danger' as const };
    default:
      return { label: 'Not added', variant: 'neutral' as const };
  }
}

interface Props {
  /** `null` is the signed-in user's own licence; an id is that employee's. */
  scope: DriverLicenceScope;
}

/** The driver's licence record, its status, and where to add or update it. */
export function DriverLicenceCard({ scope }: Props) {
  const { data, isLoading, isError } = useDriverLicence(scope);
  const [open, setOpen] = useState(false);

  // No employee record (e.g. an admin account) means there is no licence to manage here.
  if (isLoading || isError || !data) return null;

  const badge = statusBadge(data);
  const licence = data.licence;

  return (
    <>
      <div className={cardClass('p-4 flex flex-col gap-3')}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Driver&apos;s Licence</p>
            <Badge label={badge.label} variant={badge.variant} />
          </div>
          <Button size="sm" variant={licence ? 'outline' : 'primary'} onClick={() => setOpen(true)}>
            {licence ? 'Edit Details' : 'Add Licence'}
          </Button>
        </div>

        {licence ? (
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-gray-400">ID number</dt>
              <dd className="font-medium text-gray-900">{licence.licenceNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Date of issue</dt>
              <dd className="font-medium text-gray-900">{formatDate(licence.issuedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Date of expiry</dt>
              <dd className="font-medium text-gray-900">{formatDate(licence.expiresAt)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-xs text-gray-500">
            Add a licence to be able to drive yourself on company trips.
          </p>
        )}

        {licence && !data.imageOnFile && (
          <p className="text-xs text-amber-700">
            No image of the licence is on file, so driving yourself is switched off. Edit the
            details to upload one.
          </p>
        )}
        {data.status === 'EXPIRED' && (
          <p className="text-xs text-red-600">
            The licence has expired, so driving yourself is switched off. Update the details once it
            is renewed.
          </p>
        )}
        {data.status === 'EXPIRING' && (
          <p className="text-xs text-amber-700">
            The licence is about to expire. Update the details once it is renewed.
          </p>
        )}
      </div>

      <DriverLicenceModal
        isOpen={open}
        onClose={() => setOpen(false)}
        scope={scope}
        current={data}
      />
    </>
  );
}
