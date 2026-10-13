import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { buildModuleLabels, DEFAULT_PROJECT_LABEL, type ModuleLabels } from '@/lib/moduleLabels';

/** The company's name for Projects (set by the super admin), e.g. "Case" / "Cases". */
export function useProjectLabels(): ModuleLabels {
  const name = useAuthStore((s) => s.user?.labelConfig?.projects);
  return useMemo(() => buildModuleLabels(name, DEFAULT_PROJECT_LABEL), [name]);
}
