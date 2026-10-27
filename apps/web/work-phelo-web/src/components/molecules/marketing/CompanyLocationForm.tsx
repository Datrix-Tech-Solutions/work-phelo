'use client';

import { useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Button } from '@/components/atoms/Button';
import { CompanyLocationMap } from '@/components/organisms/marketing/CompanyLocationMap';
import { useGeocodeSearch } from '@/hooks';
import { geocodeReverse } from '@/lib/maptiler';
import type { NamedLocationPayload } from '@/types/marketing';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

export interface CompanyLocationFields {
  location: string;
  lat?: number;
  lng?: number;
}

/** What is sent to the API. A name with no coordinates is a location that was typed in rather than found on the map. */
export function toLocationPayload(fields: CompanyLocationFields): NamedLocationPayload | undefined {
  const label = fields.location.trim();
  if (!label) return undefined;
  return fields.lat != null && fields.lng != null
    ? { label, latitude: fields.lat, longitude: fields.lng }
    : { label };
}

interface Props {
  values: CompanyLocationFields;
  onChange: (values: CompanyLocationFields) => void;
  /** Hide the map behind a toggle; search and current location stay visible. */
  collapsibleMap?: boolean;
  /** Tighter padding and gaps, for use inside side panels. */
  compact?: boolean;
}

export function CompanyLocationForm({
  values,
  onChange,
  collapsibleMap = false,
  compact = false,
}: Props) {
  const [mapOpen, setMapOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: suggestions = [] } = useGeocodeSearch(query);

  // The currently confirmed location (from search, current-location, or the map pin) may not
  // be among the live search suggestions — merge it in so SearchSelect can still show its label.
  const pinned = values.lat != null && values.lng != null;
  const selectedValue = pinned
    ? `${values.lat},${values.lng}`
    : values.location
      ? `typed:${values.location}`
      : '';
  const options = [
    ...(selectedValue ? [{ value: selectedValue, label: values.location }] : []),
    ...suggestions
      .filter((s) => `${s.lat},${s.lng}` !== selectedValue)
      .map((s) => ({ value: `${s.lat},${s.lng}`, label: s.placeName })),
  ];

  function handleSelect(value: string) {
    const option = options.find((o) => o.value === value);
    if (!option || value.startsWith('typed:')) return;
    const [lat, lng] = value.split(',').map(Number);
    onChange({ location: option.label, lat, lng });
    setQuery('');
  }

  async function handleMapChange(lat: number, lng: number) {
    onChange({ ...values, lat, lng });
    const placeName = await geocodeReverse(lng, lat);
    if (placeName) onChange({ location: placeName, lat, lng });
  }

  function handleGetCurrentLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const placeName = await geocodeReverse(longitude, latitude);
        onChange({ location: placeName ?? values.location, lat: latitude, lng: longitude });
        setQuery('');
      },
      (err) => {
        useToastStore.getState().addToast({ message: extractError(err), type: 'error' });
      },
    );
  }

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 flex flex-col ${
        compact ? 'px-4 py-2.5 gap-2' : 'p-6 gap-4'
      }`}
    >
      {/* Search row — mirrors DataTable toolbar layout */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-52 max-w-sm">
          <SearchSelect
            size="sm"
            placeholder="Search for a location..."
            options={options}
            value={selectedValue}
            onChange={handleSelect}
            onQueryChange={setQuery}
            emptyState={({ query: typed, close }) => (
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm font-medium text-(--module-btn-bg,var(--color-brand)) hover:bg-gray-50"
                onClick={() => {
                  // Not found on the map: keep the name, with no pin until one is chosen.
                  onChange({ location: typed.trim() });
                  setQuery('');
                  close();
                }}
              >
                Use “{typed.trim()}” as typed
              </button>
            )}
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

      {values.location && (
        <div
          className={`flex items-center gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-4 ${
            compact ? 'py-1.5' : 'py-2.5'
          }`}
        >
          <MapPin className="w-4 h-4 text-(--module-btn-bg,var(--color-brand)) shrink-0" />
          <span>{values.location}</span>
          {!pinned && <span className="ml-auto text-xs text-amber-600">Not pinned on the map</span>}
        </div>
      )}

      {collapsibleMap && (
        <button
          type="button"
          onClick={() => setMapOpen((o) => !o)}
          aria-expanded={mapOpen}
          className="flex items-center gap-1.5 self-start text-sm font-medium text-(--module-btn-bg,var(--color-brand)) hover:underline"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${mapOpen ? 'rotate-180' : ''}`} />
          {mapOpen ? 'Hide map' : 'Pick on map'}
        </button>
      )}

      {(!collapsibleMap || mapOpen) && (
        <CompanyLocationMap lat={values.lat} lng={values.lng} onChange={handleMapChange} />
      )}
    </div>
  );
}
