'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Toggle } from '@/components/atoms/Toggle';
import { useLinkSourceType, useSourceTypes, useUnlinkSourceType } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { SourceModule, SourceTypeDefinition } from '@/types/accounting';

const MODULE_LABELS: Record<SourceModule, string> = {
  HR: 'HR',
  MARKETING: 'Marketing',
  ACCOUNTING: 'Accounting',
  RECRUITMENT: 'Recruitment',
  OPERATIONS: 'Operations',
};

export function SourceTypesTable() {
  const { data = [], isLoading } = useSourceTypes();
  const { mutate: link } = useLinkSourceType();
  const { mutate: unlink } = useUnlinkSourceType();
  const toast = useToast();

  const groups = useMemo(() => {
    const byModule = new Map<SourceModule, SourceTypeDefinition[]>();
    for (const item of data) {
      const list = byModule.get(item.module) ?? [];
      list.push(item);
      byModule.set(item.module, list);
    }
    return [...byModule.entries()].sort((a, b) =>
      MODULE_LABELS[a[0]].localeCompare(MODULE_LABELS[b[0]]),
    );
  }, [data]);

  const toggle = (item: SourceTypeDefinition) => {
    const action = item.isActive ? unlink : link;
    action(item.id, {
      onError: (error) =>
        toast.error(extractError(error, `Unable to ${item.isActive ? 'unlink' : 'link'}`)),
    });
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 px-6 py-10 text-center">
        <p className="text-sm font-medium text-gray-900">No sources linked yet</p>
        <p className="mt-1 text-sm text-gray-500">
          Entries show up here automatically once another module (like Payroll) completes its own
          accounting setup — there&apos;s nothing to create from this page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map(([module, items]) => (
        <div key={module} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {MODULE_LABELS[module]}
          </h3>
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-left text-sm">
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 first:border-t-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3">
                      <Badge
                        label={item.isActive ? 'Linked' : 'Unlinked'}
                        variant={item.isActive ? 'success' : 'neutral'}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Toggle enabled={item.isActive} onChange={() => toggle(item)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
