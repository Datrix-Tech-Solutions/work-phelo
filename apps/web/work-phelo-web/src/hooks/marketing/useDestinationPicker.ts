import { useEffect, useMemo, useState } from 'react';
import { useDestinationOptions } from '@/hooks/marketing/useRequests';
import type { DestinationOption, TransportStopRef } from '@/types/marketing';

/** Identifies a client or prospect in a multi-select, where values are plain strings. */
export const destinationKey = (place: { kind: string; id: string }) => `${place.kind}:${place.id}`;

const SEARCH_DELAY_MS = 250;

/**
 * The logic behind a "pick clients or prospects" field: a server-side name search, the places
 * chosen so far, and the options to hand to a MultiSelect. The caller renders the field and the
 * list of chosen places (name, kind and location), as with the other employee pickers.
 */
export function useDestinationPicker(
  initial: DestinationOption[] = [],
  /** Places that can't be chosen (e.g. already on the trip). */
  exclude: { kind: string; id: string }[] = [],
) {
  const [selected, setSelected] = useState<DestinationOption[]>(initial);
  const [touched, setTouched] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: found, isLoading } = useDestinationOptions(debounced);
  const excluded = useMemo(() => new Set(exclude.map(destinationKey)), [exclude]);

  // Chosen places stay in the list even when the current search no longer returns them.
  const known = useMemo(() => {
    const byKey = new Map<string, DestinationOption>();
    for (const place of found ?? []) byKey.set(destinationKey(place), place);
    for (const place of selected) byKey.set(destinationKey(place), place);
    return byKey;
  }, [found, selected]);

  const options = useMemo(
    () =>
      [...known.values()]
        .filter((place) => !excluded.has(destinationKey(place)))
        .map((place) => ({
          value: destinationKey(place),
          label: place.name,
          sublabel: `${place.kind === 'CLIENT' ? 'Client' : 'Prospect'} · ${place.locationLabel}`,
        })),
    [known, excluded],
  );

  function onChange(keys: string[]) {
    setSelected(
      keys.flatMap((key) => {
        const place = known.get(key);
        return place ? [place] : [];
      }),
    );
    setTouched(true);
    // Back to the full list after picking, instead of staying filtered by the last search.
    setSearch('');
  }

  function remove(place: DestinationOption) {
    setSelected((current) => current.filter((p) => destinationKey(p) !== destinationKey(place)));
    setTouched(true);
  }

  function reset(next: DestinationOption[] = []) {
    setSelected(next);
    setTouched(false);
    setSearch('');
  }

  return {
    selected,
    selectedKeys: selected.map(destinationKey),
    refs: selected.map<TransportStopRef>((place) => ({ kind: place.kind, id: place.id })),
    options,
    /** True when the field has nothing to offer at all (no search typed and nothing found). */
    isEmpty: !isLoading && !debounced && (found ?? []).length === 0 && selected.length === 0,
    isLoading,
    /** The person has added or removed a place, so the list should be sent when saving. */
    touched,
    setSearch,
    onChange,
    remove,
    reset,
  };
}
