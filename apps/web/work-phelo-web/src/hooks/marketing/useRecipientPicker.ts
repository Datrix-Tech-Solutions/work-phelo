import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCampaignRecipientOptions } from '@/hooks/marketing/useCampaigns';
import type { CampaignRecipientOption } from '@/types/marketing';

const SEARCH_DELAY_MS = 250;

/**
 * The logic behind a "pick specific prospects" field when building a segment: a server-side name
 * search (optionally within some filters) and the prospects picked so far. The caller renders the
 * field and the list of chosen prospects.
 */
export function useRecipientPicker(
  filters: { businessTypeIds?: string[]; pipelineStageIds?: string[] } = {},
  initial: CampaignRecipientOption[] = [],
) {
  const [selected, setSelected] = useState<CampaignRecipientOption[]>(initial);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: found, isLoading } = useCampaignRecipientOptions(filters, debounced);

  // Chosen prospects stay in the list even when the current search no longer returns them.
  const known = useMemo(() => {
    const byId = new Map<string, CampaignRecipientOption>();
    for (const prospect of found ?? []) byId.set(prospect.id, prospect);
    for (const prospect of selected) byId.set(prospect.id, prospect);
    return byId;
  }, [found, selected]);

  const options = useMemo(
    () =>
      [...known.values()].map((prospect) => ({
        value: prospect.id,
        label: prospect.companyName,
        sublabel: [prospect.contactName, prospect.locationLabel].filter(Boolean).join(' · '),
      })),
    [known],
  );

  function onChange(ids: string[]) {
    setSelected(
      ids.flatMap((id) => {
        const prospect = known.get(id);
        return prospect ? [prospect] : [];
      }),
    );
    // Back to the full list after picking, instead of staying filtered by the last search.
    setSearch('');
  }

  function remove(id: string) {
    setSelected((current) => current.filter((prospect) => prospect.id !== id));
  }

  const reset = useCallback(() => {
    setSelected([]);
    setSearch('');
  }, []);

  return {
    selected,
    selectedIds: selected.map((prospect) => prospect.id),
    options,
    isLoading,
    setSearch,
    onChange,
    remove,
    reset,
  };
}
