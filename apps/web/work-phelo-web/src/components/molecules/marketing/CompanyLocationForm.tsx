'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Button } from '@/components/atoms/Button';
import { CompanyLocationMap } from '@/components/organisms/marketing/CompanyLocationMap';
import { useGeocodeSearch } from '@/hooks';
import { geocodeReverse } from '@/lib/maptiler';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

export interface CompanyLocationFields {
  location: string;
  lat?: number;
  lng?: number;
}

interface Props {
  values: CompanyLocationFields;
  onChange: (values: CompanyLocationFields) => void;
}

export function CompanyLocationForm({ values, onChange }: Props) {
  const [query, setQuery] = useState(values.location);
  const { data: suggestions = [] } = useGeocodeSearch(query);

  const options = suggestions.map((s) => ({
    value: `${s.lat},${s.lng}`,
    label: s.placeName,
  }));

  function handleSelect(value: string) {
    const option = options.find((o) => o.value === value);
    if (!option) return;
    const [lat, lng] = value.split(',').map(Number);
    onChange({ location: option.label, lat, lng });
  }

  function handleMapChange(lat: number, lng: number) {
    onChange({ ...values, lat, lng });
  }

  function handleGetCurrentLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const placeName = await geocodeReverse(longitude, latitude);
        onChange({ location: placeName ?? values.location, lat: latitude, lng: longitude });
        setQuery(placeName ?? '');
      },
      (err) => {
        useToastStore.getState().addToast({ message: extractError(err), type: 'error' });
      },
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-4">
      {/* Search row — mirrors DataTable toolbar layout */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-52 max-w-sm">
          <SearchSelect
            size="sm"
            placeholder="Search for a location..."
            options={options}
            value={values.lat != null ? `${values.lat},${values.lng}` : ''}
            onChange={handleSelect}
            onQueryChange={setQuery}
          />
        </div>
        <div className="flex-1" />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleGetCurrentLocation}
          icon={<MapPin className="w-4 h-4" />}
        >
          Get Current Location
        </Button>
      </div>

      <CompanyLocationMap lat={values.lat} lng={values.lng} onChange={handleMapChange} />
    </div>
  );
}
