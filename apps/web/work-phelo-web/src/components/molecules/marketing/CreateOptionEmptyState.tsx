'use client';

import { useCreateProspectingSetting } from '@/hooks/marketing/useProspectingSettings';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';

/**
 * Builds a `SearchSelect` `emptyState` renderer that lets the user create a new CRM Settings
 * option (business type, source type, interaction medium, decision maker or product) inline,
 * from whatever they typed, instead of only being able to pick from what already exists.
 *
 * `label` names the thing being created ("business type", "product", …) for the button copy.
 * `onCreated` is called with the new option's id once it's saved — the caller is responsible
 * for selecting it (and, for a per-row field like the product picker, knowing which row).
 */
export function buildCreateOptionEmptyState(
  label: string,
  create: ReturnType<typeof useCreateProspectingSetting>,
  onCreated: (id: string) => void,
  toast: ReturnType<typeof useToast>,
) {
  return function CreateOptionEmptyState({ query, close }: { query: string; close: () => void }) {
    const name = query.trim();

    if (!name) {
      return <p className="px-4 py-3 text-sm text-gray-400 text-center">No results found</p>;
    }

    return (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()} // keep the input focused until the click lands
        disabled={create.isPending}
        onClick={() => {
          create.mutate(
            { name },
            {
              onSuccess: (created) => {
                onCreated(created.id);
                close();
              },
              onError: (error) => toast.error(apiErrorMessage(error, `Failed to create ${label}`)),
            },
          );
        }}
        className="w-full text-left px-4 py-3 text-sm font-medium text-(--module-btn-bg,var(--color-brand)) hover:bg-gray-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {create.isPending ? 'Creating…' : `+ Create "${name}" as a new ${label}`}
      </button>
    );
  };
}
