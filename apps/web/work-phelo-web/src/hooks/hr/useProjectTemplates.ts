import { useMemo } from 'react';
import { DEFAULT_PROJECT_TEMPLATES } from '@/lib/defaultProjectTemplates';
import { useProjectTemplatesStore } from '@/store/projectTemplates.store';

/** Every template a project can start from: the built-in ones with any edits applied, then the custom ones. */
export function useProjectTemplates() {
  const custom = useProjectTemplatesStore((s) => s.templates);
  const defaultOverrides = useProjectTemplatesStore((s) => s.defaultOverrides);

  const templates = useMemo(
    () => [
      ...DEFAULT_PROJECT_TEMPLATES.map((t) => ({ ...t, ...defaultOverrides[t.id] })),
      ...custom,
    ],
    [custom, defaultOverrides],
  );

  return { templates, defaultOverrides };
}
