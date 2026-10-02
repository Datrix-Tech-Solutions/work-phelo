'use client';

import { useMemo, useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  useCreateFleetVehicle,
  useFleetOptions,
  useUpdateFleetVehicle,
} from '@/hooks/marketing/useFleet';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { FUEL_TYPE_OPTIONS, VEHICLE_TYPE_OPTIONS } from '@/lib/fleetOptions';
import { inputClass } from '@/lib/utils';
import type { FleetVehicle } from '@/types/marketing';

interface FormValues {
  vehicleType: string;
  make: string;
  model: string;
  yearOfRegistration: string;
  fuelType: string;
  currentMileage: string;
  branchId: string;
  assignedDriverId: string;
  status: string;
}

type FormErrors = Partial<
  Record<
    'vehicleType' | 'make' | 'model' | 'yearOfRegistration' | 'fuelType' | 'currentMileage',
    string
  >
>;

const EMPTY: FormValues = {
  vehicleType: '',
  make: '',
  model: '',
  yearOfRegistration: '',
  fuelType: '',
  currentMileage: '',
  branchId: '',
  assignedDriverId: '',
  status: 'AVAILABLE',
};

const MIN_YEAR = 1950;
const INITIAL_STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'MAINTENANCE', label: 'Under Maintenance' },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-2">{children}</p>
  );
}

function valuesFor(vehicle: FleetVehicle): FormValues {
  return {
    ...EMPTY,
    vehicleType: vehicle.vehicleType ?? '',
    make: vehicle.make ?? '',
    model: vehicle.model ?? '',
    yearOfRegistration: vehicle.yearOfRegistration?.toString() ?? '',
    fuelType: vehicle.fuelType ?? '',
    currentMileage: vehicle.currentMileage?.toString() ?? '',
    branchId: vehicle.branch?.id ?? '',
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** When set the panel edits this vehicle; otherwise it creates a new one. */
  vehicle?: FleetVehicle | null;
}

export function FleetVehiclePanel({ isOpen, onClose, vehicle }: Props) {
  const toast = useToast();
  const createVehicle = useCreateFleetVehicle();
  const updateVehicle = useUpdateFleetVehicle();
  const { data: options } = useFleetOptions();
  const isEdit = !!vehicle;
  const isPending = createVehicle.isPending || updateVehicle.isPending;

  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  // Re-seed the form whenever the panel opens for a different vehicle (or for create).
  const seedKey = isOpen ? (vehicle?.assetId ?? 'new') : null;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (seedKey !== seededFor) {
    setSeededFor(seedKey);
    setValues(vehicle ? valuesFor(vehicle) : EMPTY);
    setErrors({});
  }

  const branchOptions = useMemo(
    () => (options?.branches ?? []).map((b) => ({ value: b.id, label: b.name })),
    [options],
  );
  const driverOptions = useMemo(
    () => (options?.drivers ?? []).map((d) => ({ value: d.id, label: d.name })),
    [options],
  );

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    onClose();
  }

  function validate(): boolean {
    const next: FormErrors = {};
    const year = Number(values.yearOfRegistration);
    const mileage = Number(values.currentMileage);
    if (!values.vehicleType) next.vehicleType = 'Vehicle type is required.';
    if (!values.make.trim()) next.make = 'Make is required.';
    if (!values.model.trim()) next.model = 'Model is required.';
    if (!Number.isInteger(year) || year < MIN_YEAR || year > new Date().getFullYear() + 1) {
      next.yearOfRegistration = 'Enter a valid year of registration.';
    }
    if (!values.fuelType) next.fuelType = 'Fuel type is required.';
    if (values.currentMileage.trim() === '' || !Number.isInteger(mileage) || mileage < 0) {
      next.currentMileage = 'Enter the current mileage in km.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function details() {
    return {
      vehicleType: values.vehicleType,
      make: values.make.trim(),
      model: values.model.trim(),
      yearOfRegistration: Number(values.yearOfRegistration),
      fuelType: values.fuelType,
      currentMileage: Number(values.currentMileage),
    };
  }

  function handleSubmit() {
    if (!validate()) return;

    if (vehicle) {
      updateVehicle.mutate(
        {
          assetId: vehicle.assetId,
          ...details(),
          branchId: values.branchId || null,
        },
        {
          onSuccess: () => {
            toast.success('Vehicle updated');
            handleClose();
          },
          onError: (error) => toast.error(apiErrorMessage(error, 'Failed to update vehicle')),
        },
      );
      return;
    }

    createVehicle.mutate(
      {
        ...details(),
        ...(values.branchId ? { branchId: values.branchId } : {}),
        ...(values.assignedDriverId ? { assignedDriverId: values.assignedDriverId } : {}),
        status: values.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'AVAILABLE',
      },
      {
        onSuccess: (created) => {
          if (created.warnings.length) {
            toast.error(created.warnings.join(' '));
          } else {
            toast.success('Vehicle added');
          }
          handleClose();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to add vehicle')),
      },
    );
  }

  const textField = (key: 'make' | 'model', label: string, placeholder: string) => (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
      <label className="text-sm font-bold text-gray-900">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={values[key]}
        onChange={(e) => set(key, e.target.value)}
        className={inputClass(errors[key])}
      />
      {errors[key] && <p className="text-xs text-red-500">{errors[key]}</p>}
    </div>
  );

  const numberField = (
    key: 'yearOfRegistration' | 'currentMileage',
    label: string,
    placeholder: string,
  ) => (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
      <label className="text-sm font-bold text-gray-900">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        placeholder={placeholder}
        value={values[key]}
        onChange={(e) => set(key, e.target.value)}
        className={inputClass(errors[key])}
      />
      {errors[key] && <p className="text-xs text-red-500">{errors[key]}</p>}
    </div>
  );

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={
        isEdit ? (vehicle?.needsFleetDetails ? 'Add Fleet Details' : 'Edit Vehicle') : 'Add Vehicle'
      }
      description={
        isEdit
          ? 'Update this vehicle’s fleet details.'
          : 'Register a new vehicle. It will also appear in HR assets.'
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isPending} loadingText="Saving…">
            {isEdit ? 'Save Changes' : 'Add Vehicle'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        <SectionTitle>Vehicle Details</SectionTitle>

        <SearchSelect
          label="Vehicle Type"
          placeholder="Select vehicle type"
          options={VEHICLE_TYPE_OPTIONS}
          value={values.vehicleType}
          onChange={(v) => set('vehicleType', v)}
          error={errors.vehicleType}
        />

        <div className="grid grid-cols-2 gap-4">
          {textField('make', 'Make', 'eg; Toyota')}
          {textField('model', 'Model', 'eg; Hilux')}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {numberField('yearOfRegistration', 'Year of Registration', 'eg; 2022')}
          <SearchSelect
            label="Fuel Type"
            placeholder="Select fuel type"
            options={FUEL_TYPE_OPTIONS}
            value={values.fuelType}
            onChange={(v) => set('fuelType', v)}
            error={errors.fuelType}
          />
        </div>

        {numberField('currentMileage', 'Current Mileage (km)', 'eg; 45000')}

        <SectionTitle>Assignment</SectionTitle>

        <SearchSelect
          label="Branch"
          placeholder="Select branch"
          options={branchOptions}
          value={values.branchId}
          onChange={(v) => set('branchId', v)}
        />

        {!isEdit && (
          <>
            <SearchSelect
              label="Assigned Driver"
              placeholder="Select driver"
              options={driverOptions}
              value={values.assignedDriverId}
              onChange={(v) => set('assignedDriverId', v)}
              disabled={values.status === 'MAINTENANCE'}
            />
            <SearchSelect
              label="Status"
              placeholder="Select status"
              options={INITIAL_STATUS_OPTIONS}
              value={values.status}
              onChange={(v) => {
                set('status', v);
                if (v === 'MAINTENANCE') set('assignedDriverId', '');
              }}
            />
          </>
        )}
      </div>
    </SidePanel>
  );
}
