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

export const FLEET_STATUS_STYLES: Record<FleetStatus, { label: string; text: string; bg: string }> =
  {
    AVAILABLE: { label: 'Available', text: 'text-green-700', bg: 'bg-green-50' },
    ASSIGNED: { label: 'Assigned', text: 'text-blue-700', bg: 'bg-blue-50' },
    MAINTENANCE: { label: 'Maintenance', text: 'text-yellow-700', bg: 'bg-yellow-50' },
    RETIRED: { label: 'Retired', text: 'text-gray-500', bg: 'bg-gray-100' },
  };

export const labelFor = (options: { value: string; label: string }[], value: string | null) =>
  options.find((option) => option.value === value)?.label ?? value ?? '—';
