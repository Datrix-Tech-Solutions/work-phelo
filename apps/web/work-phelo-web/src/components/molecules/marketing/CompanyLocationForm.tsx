'use client';

import { MapPin } from 'lucide-react';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Button } from '@/components/atoms/Button';

export interface CompanyLocationFields {
  location: string;
}

interface Props {
  values: CompanyLocationFields;
  onChange: (values: CompanyLocationFields) => void;
  locationOptions?: { value: string; label: string }[];
  onGetCurrentLocation?: () => void;
}

export function CompanyLocationForm({
  values,
  onChange,
  locationOptions = [],
  onGetCurrentLocation,
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-4">
      {/* Search row — mirrors DataTable toolbar layout */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-52 max-w-sm">
          <SearchSelect
            size="sm"
            placeholder="Search for a location..."
            options={locationOptions}
            value={values.location}
            onChange={(v) => onChange({ ...values, location: v })}
          />
        </div>
        <div className="flex-1" />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onGetCurrentLocation}
          icon={<MapPin className="w-4 h-4" />}
        >
          Get Current Location
        </Button>
      </div>

      {/* Map placeholder */}
      <div className="h-150 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center">
        <p className="text-sm text-gray-400" />
      </div>
    </div>
  );
}
