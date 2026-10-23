'use client';

import { cn } from '@/lib/utils';
import type { PermissionAction, PermissionSetResourceDto } from '@/types/roles';

export interface PermissionTag {
  key: string;
  label: string;
  /** Pills that are switched on with this one; switching any of them off switches this one off. */
  implies?: string[];
}

export interface PermissionSection {
  key: string;
  label: string;
  /** Heading the section is listed under; sections sharing one are shown together, in order. */
  group?: string;
  tags: PermissionTag[];
}

export type PermissionPair = { resource: string; action: string };

export const pairs = (resource: string, actions: string[]): PermissionPair[] =>
  actions.map((action) => ({ resource, action }));

/** Turns the selected pills into the resource/action DTOs the permission-set API expects. */
export function buildPermissionResources(
  mapping: Record<string, PermissionPair[]>,
  selectedKeys: string[],
  resourceIdMap: Map<string, string>,
): PermissionSetResourceDto[] {
  const seen = new Set<string>();
  const dtos: PermissionSetResourceDto[] = [];

  for (const key of selectedKeys) {
    for (const { resource, action } of mapping[key] ?? []) {
      const resourceId = resourceIdMap.get(resource);
      if (!resourceId) continue;
      const id = `${resourceId}:${action}`;
      if (seen.has(id)) continue;
      seen.add(id);
      dtos.push({ resourceId, action: action as PermissionAction });
    }
  }

  return dtos;
}

/** Reverse-maps a set's existing resource:action pairs back to the pills they fully cover. */
export function inferTagsFromResources(
  mapping: Record<string, PermissionPair[]>,
  resources: Array<{ resource: { name: string }; action: string }>,
): string[] {
  const has = new Set(resources.map((r) => `${r.resource.name}:${r.action}`));
  return Object.entries(mapping)
    .filter(
      ([, perms]) =>
        perms.length > 0 && perms.every(({ resource, action }) => has.has(`${resource}:${action}`)),
    )
    .map(([key]) => key);
}

interface PermissionPillSectionsProps {
  sections: PermissionSection[];
  value: string[];
  onChange: (value: string[]) => void;
}

/** Pills grouped by section. A pill can imply others: switching it on adds them, off removes its dependants. */
export function PermissionPillSections({ sections, value, onChange }: PermissionPillSectionsProps) {
  const selected = new Set(value);

  const toggle = (section: PermissionSection, key: string) => {
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
      section.tags.filter((t) => t.implies?.includes(key)).forEach((t) => next.delete(t.key));
    } else {
      next.add(key);
      section.tags.find((t) => t.key === key)?.implies?.forEach((k) => next.add(k));
    }
    onChange(Array.from(next));
  };

  // Each group shows one heading over the pills of all its sections, groups in the order they first appear.
  const groups: Array<{ label?: string; sections: PermissionSection[] }> = [];
  for (const section of sections) {
    const group = groups.find((g) => g.label === section.group);
    if (group) group.sections.push(section);
    else groups.push({ label: section.group, sections: [section] });
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label ?? 'ungrouped'} className="flex flex-col gap-3">
          {group.label && <p className="text-sm font-semibold text-gray-700">{group.label}</p>}
          <div className="flex flex-wrap gap-2">
            {group.sections.flatMap((section) =>
              section.tags.map((tag) => (
                <button
                  key={tag.key}
                  type="button"
                  onClick={() => toggle(section, tag.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                    selected.has(tag.key)
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700',
                  )}
                >
                  {tag.label}
                </button>
              )),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
