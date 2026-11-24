'use client';

import { useEffect, useMemo, useState } from 'react';
import { SearchSelect, type SearchSelectOption } from '@/components/atoms/SearchSelect';
import { Button } from '@/components/atoms/Button';
import { useClients } from '@/hooks/marketing/useClients';
import { useCreateProjectClient, useProjectClients } from '@/hooks/hr/useProjectClients';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { useAuthStore } from '@/store/auth.store';
import type { ProjectClientSource } from '@/types/hr';

export interface PickedProjectClient {
  id: string;
  name: string;
  source: ProjectClientSource;
}

/** The select's value: the list the client comes from, then its id, so the two lists can never clash. */
export const clientValue = (source: ProjectClientSource, id: string) => `${source}:${id}`;

const SEARCH_DELAY_MS = 250;

interface Props {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string, client?: PickedProjectClient) => void;
  error?: string;
}

/**
 * Picks a client for a project from marketing's clients (when the tenant has marketing) and the
 * ones made from project management. A name that already exists is found in the list and gets no
 * create button; one that does not can be added on the spot with just its name.
 */
export function ProjectClientSelect({
  label = 'Client',
  placeholder = 'Select or add a client (optional)',
  value,
  onChange,
  error,
}: Props) {
  const toast = useToast();
  const marketingEnabled = useAuthStore((s) => !!s.user?.moduleConfig?.marketing);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  // Clients added in this form, so the one just created shows as selected before the lists refresh.
  const [added, setAdded] = useState<PickedProjectClient[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Just a pick-list of the marketing clients, so it isn't held back by the person's marketing access.
  const marketing = useClients({ limit: 100, search: search || undefined }, marketingEnabled);
  const projectClients = useProjectClients(search);
  const createClient = useCreateProjectClient();

  const clients = useMemo(() => {
    const byValue = new Map<string, PickedProjectClient>();
    for (const c of marketing.data?.data ?? []) {
      byValue.set(clientValue('MARKETING', c.id), {
        id: c.id,
        name: c.companyName,
        source: 'MARKETING',
      });
    }
    for (const c of [
      ...(projectClients.data ?? []),
      ...added.filter((a) => a.source === 'PROJECT'),
    ]) {
      byValue.set(clientValue('PROJECT', c.id), { id: c.id, name: c.name, source: 'PROJECT' });
    }
    return byValue;
  }, [marketing.data, projectClients.data, added]);

  // The picked client stays an option while the list is narrowed by a search that no longer shows it.
  const [picked, setPicked] = useState<PickedProjectClient | null>(null);
  const options = useMemo<SearchSelectOption[]>(() => {
    const list = new Map(clients);
    if (picked && !list.has(clientValue(picked.source, picked.id))) {
      list.set(clientValue(picked.source, picked.id), picked);
    }
    return [...list.entries()]
      .sort(([, a], [, b]) => a.name.localeCompare(b.name))
      .map(([key, c]) => ({
        value: key,
        label: c.name,
        // Only worth saying which list it is from when there are two. A tag, not a sublabel: the
        // search matches sublabels, so typing "market" would wrongly find every marketing client.
        ...(marketingEnabled && c.source === 'MARKETING' ? { tag: 'Marketing' } : {}),
      }));
  }, [clients, picked, marketingEnabled]);

  const searching = query.trim() !== search || marketing.isFetching || projectClients.isFetching;

  function handleChange(next: string) {
    const client = next ? (clients.get(next) ?? picked ?? undefined) : undefined;
    setPicked(client ?? null);
    onChange(next, client);
  }

  async function handleCreate(name: string, close: () => void) {
    try {
      const created = await createClient.mutateAsync(name);
      const client: PickedProjectClient = { id: created.id, name: created.name, source: 'PROJECT' };
      setAdded((prev) => [...prev, client]);
      setPicked(client);
      onChange(clientValue('PROJECT', client.id), client);
      close();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to add the client'));
    }
  }

  return (
    <SearchSelect
      label={label}
      placeholder={placeholder}
      options={options}
      value={value}
      onChange={handleChange}
      onQueryChange={setQuery}
      error={error}
      emptyState={({ query: typed, close }) => {
        const name = typed.trim();
        if (!name) {
          return (
            <p className="px-4 py-3 text-sm text-gray-400">Type a name to find or add a client</p>
          );
        }
        // The lists are still catching up with what was typed; a name must not be offered for
        // creation until we know it is not already there.
        if (searching) {
          return <p className="px-4 py-3 text-sm text-gray-400">Searching…</p>;
        }
        return (
          <div className="flex flex-col gap-2 px-4 py-3">
            <p className="text-sm text-gray-500">No client named &ldquo;{name}&rdquo;</p>
            <Button
              variant="outline"
              isLoading={createClient.isPending}
              loadingText="Adding…"
              onClick={() => handleCreate(name, close)}
            >
              Add &ldquo;{name}&rdquo;
            </Button>
          </div>
        );
      }}
    />
  );
}
