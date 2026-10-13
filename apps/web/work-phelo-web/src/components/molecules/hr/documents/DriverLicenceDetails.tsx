'use client';

import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { DriverLicenceModal } from '@/components/organisms/hr/documents/DriverLicenceModal';
import { useDriverLicence, type DriverLicenceScope } from '@/hooks/hr/useDriverLicence';
import { formatDate } from '@/lib/formatters';
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
      return { label: 'No details', variant: 'neutral' as const };
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right truncate">{value}</span>
    </div>
  );
}

interface Props {
  /** `null` is the signed-in user's own licence; an id is that employee's. */
  scope: DriverLicenceScope;
}

/**
 * The licence details shown in the detail panel of a driver's-licence document, where they can
 * also be updated. The image is the document itself; the details are what the dates are judged on.
 */
export function DriverLicenceDetails({ scope }: Props) {
  const { data, isLoading } = useDriverLicence(scope);
  const [editing, setEditing] = useState(false);

  if (isLoading || !data) return null;
  const badge = statusBadge(data);
  const licence = data.licence;

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Licence details
        </p>
        <Badge label={badge.label} variant={badge.variant} />
      </div>

      {licence && (
        <div>
          <Row label="ID number" value={licence.licenceNumber} />
          <Row label="Date of issue" value={formatDate(licence.issuedAt)} />
          <Row label="Date of expiry" value={formatDate(licence.expiresAt)} />
        </div>
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

      {licence && (
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Update Details
        </Button>
      )}

      <DriverLicenceModal
        isOpen={editing}
        onClose={() => setEditing(false)}
        scope={scope}
        current={data}
      />
    </div>
  );
}
