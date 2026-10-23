'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ClipboardCheck, Plus, Truck, UserPlus } from 'lucide-react';
import {
  QuickActionEntry,
  QuickActionTiles,
} from '@/components/molecules/marketing/QuickActionTiles';
import { AddTransportOfficersPanel } from '@/components/organisms/marketing/AddTransportOfficersPanel';
import { FleetVehiclePanel } from '@/components/organisms/marketing/FleetVehiclePanel';
import { RequestPanel } from '@/components/organisms/marketing/RequestPanel';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';

type Action = 'request' | 'approve' | 'vehicle' | 'driver';

/** The Transport dashboard's shortcuts: raise a request, review requests, add a vehicle or a driver. */
export function TransportQuickActions({
  className,
  fillCell = false,
}: {
  className?: string;
  /** On wide screens, fill the grid cell instead of adding to its height. */
  fillCell?: boolean;
}) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const [active, setActive] = useState<Action | null>(null);

  const canRequest = useAnyPermissionRules(['marketing.requests:CREATE']);
  const canApprove = useAnyPermissionRules(['marketing.requests.all:APPROVE']);
  const canAddVehicle = useAnyPermissionRules(['marketing.fleet:CREATE']);
  // Drivers are the company's transport officers.
  const canAddDriver = useAnyPermissionRules(['marketing.transport-officers:CREATE']);

  const entries = useMemo<QuickActionEntry<Action>[]>(
    () => [
      { key: 'request', label: 'New Request', icon: Plus, color: '#2a78d6', allowed: canRequest },
      {
        key: 'approve',
        label: 'Review Requests',
        icon: ClipboardCheck,
        color: '#eb6834',
        allowed: canApprove,
      },
      {
        key: 'vehicle',
        label: 'Add Vehicle',
        icon: Truck,
        color: '#1baf7a',
        allowed: canAddVehicle,
      },
      {
        key: 'driver',
        label: 'Add Driver',
        icon: UserPlus,
        color: '#7c3aed',
        allowed: canAddDriver,
      },
    ],
    [canRequest, canApprove, canAddVehicle, canAddDriver],
  );

  function handleSelect(action: Action) {
    if (action === 'approve') {
      router.push(`/${tenantSlug}/marketing/requests/all-requests`);
      return;
    }
    setActive(action);
  }

  return (
    <>
      <QuickActionTiles
        storageKey="transport-quick-actions-usage"
        entries={entries}
        onSelect={handleSelect}
        className={className}
        fillCell={fillCell}
      />

      <RequestPanel isOpen={active === 'request'} onClose={() => setActive(null)} />
      <FleetVehiclePanel isOpen={active === 'vehicle'} onClose={() => setActive(null)} />
      <AddTransportOfficersPanel isOpen={active === 'driver'} onClose={() => setActive(null)} />
    </>
  );
}
