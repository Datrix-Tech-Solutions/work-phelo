import type { FleetStatus } from '@/types/marketing';

export { VEHICLE_TYPE_OPTIONS } from '@/lib/assetOptions';

export const FUEL_TYPE_OPTIONS = [
  { value: 'PETROL', label: 'Petrol' },
  { value: 'DIESEL', label: 'Diesel' },
  { value: 'ELECTRIC', label: 'Electric' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'LPG', label: 'LPG' },
  { value: 'OTHER', label: 'Other' },
];

export const FLEET_STATUS_OPTIONS: { value: FleetStatus; label: string }[] = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'MAINTENANCE', label: 'Under Maintenance' },
  { value: 'RETIRED', label: 'Retired' },
];

export const FLEET_STATUS_BADGES: Record<
  FleetStatus,
  { label: string; variant: 'success' | 'info' | 'warning' | 'danger' }
> = {
  AVAILABLE: { label: 'Available', variant: 'success' },
  ASSIGNED: { label: 'Assigned', variant: 'info' },
  MAINTENANCE: { label: 'Under Maintenance', variant: 'warning' },
  RETIRED: { label: 'Retired', variant: 'danger' },
};

export const labelFor = (options: { value: string; label: string }[], value: string | null) =>
  options.find((option) => option.value === value)?.label ?? value ?? '—';
