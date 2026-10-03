'use client';

import { Truck } from 'lucide-react';
import { DataCard, DataCardAction, DataCardDetail } from '@/components/organisms/shared/DataCard';
import {
  FLEET_STATUS_STYLES,
  FUEL_TYPE_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
  labelFor,
} from '@/lib/fleetOptions';
import { cn } from '@/lib/utils';
import type { FleetVehicle } from '@/types/marketing';

interface Props {
  vehicle: FleetVehicle;
  /** Omit a handler to hide that action (e.g. when the user lacks the permission). */
  onEdit?: () => void;
  onAssignDriver?: () => void;
  onUnassignDriver?: () => void;
  onSetStatus?: (status: 'AVAILABLE' | 'MAINTENANCE') => void;
  onRetire?: () => void;
}

const value = (text: string | number | null | undefined, className = 'text-gray-700') => (
  <span className={cn('text-xs font-semibold truncate max-w-[60%] text-right', className)}>
    {text ?? '—'}
  </span>
);

export function FleetCard({
  vehicle,
  onEdit,
  onAssignDriver,
  onUnassignDriver,
  onSetStatus,
  onRetire,
}: Props) {
  const { status } = vehicle;
  const statusStyle = FLEET_STATUS_STYLES[status];

  const actions: DataCardAction[] = [];
  if (onEdit) {
    actions.push({
      label: vehicle.needsFleetDetails ? 'Add Details' : 'Edit',
      onClick: onEdit,
      className: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    });
  }
  if (status === 'ASSIGNED') {
    if (onAssignDriver) {
      actions.push({
        label: 'Reassign',
        onClick: onAssignDriver,
        className: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
      });
    }
    if (onUnassignDriver) {
      actions.push({
        label: 'Unassign',
        onClick: onUnassignDriver,
        className: 'bg-orange-50 text-orange-600 hover:bg-orange-100',
      });
    }
  } else if (status === 'AVAILABLE') {
    if (onAssignDriver) {
      actions.push({
        label: 'Assign',
        onClick: onAssignDriver,
        className: 'bg-green-50 text-green-600 hover:bg-green-100',
      });
    }
    if (onSetStatus) {
      actions.push({
        label: 'Service',
        onClick: () => onSetStatus('MAINTENANCE'),
        className: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
      });
    }
  } else if (status === 'MAINTENANCE' && onSetStatus) {
    actions.push({
      label: 'Available',
      onClick: () => onSetStatus('AVAILABLE'),
      className: 'bg-green-50 text-green-600 hover:bg-green-100',
    });
  }
  if (status !== 'RETIRED' && onRetire) {
    actions.push({
      label: 'Retire',
      onClick: onRetire,
      className: 'bg-red-50 text-red-600 hover:bg-red-100',
    });
  }

  const details: DataCardDetail[] = vehicle.needsFleetDetails
    ? [
        {
          label: 'Fleet details',
          value: value('Not added yet', 'text-amber-600'),
        },
        { label: 'Branch', value: value(vehicle.branch?.name) },
        {
          label: 'Driver',
          value: value(
            vehicle.assignedDriver?.name ?? 'Unassigned',
            vehicle.assignedDriver ? 'text-blue-600' : 'text-gray-400',
          ),
        },
      ]
    : [
        { label: 'Type', value: value(labelFor(VEHICLE_TYPE_OPTIONS, vehicle.vehicleType)) },
        { label: 'Registered', value: value(vehicle.yearOfRegistration) },
        { label: 'Fuel', value: value(labelFor(FUEL_TYPE_OPTIONS, vehicle.fuelType)) },
        {
          label: 'Mileage',
          value: value(
            vehicle.currentMileage != null
              ? `${vehicle.currentMileage.toLocaleString('en-GB')} km`
              : null,
          ),
        },
        { label: 'Branch', value: value(vehicle.branch?.name) },
        {
          label: 'Driver',
          value: value(
            vehicle.assignedDriver?.name ?? 'Unassigned',
            vehicle.assignedDriver ? 'text-blue-600' : 'text-gray-400',
          ),
        },
      ];

  return (
    <DataCard
      compact
      icon={
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-orange-100">
          <Truck className="w-5 h-5 text-orange-700" />
        </div>
      }
      title={vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : vehicle.name}
      subtitle={vehicle.assetNumber}
      badge={
        <span
          className={cn(
            'px-2.5 py-1 rounded-full text-xs font-semibold shrink-0',
            statusStyle.bg,
            statusStyle.text,
          )}
        >
          {statusStyle.label}
        </span>
      }
      details={details}
      actions={actions}
    />
  );
}
