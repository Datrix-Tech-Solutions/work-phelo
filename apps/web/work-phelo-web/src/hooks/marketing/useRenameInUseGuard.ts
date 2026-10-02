import { useState } from 'react';
import { api } from '@/lib/api';
import { ProspectingSettingSlug } from '@/types/marketing';

export type CrmSettingUsageSlug = ProspectingSettingSlug | 'pipeline-stages';

async function fetchUsage(slug: CrmSettingUsageSlug, id: string) {
  const res = await api.get<{ inUse: boolean }>(`/marketing/crm-settings/usage/${slug}/${id}`);
  return res.data.inUse;
}

/**
 * Before renaming a CRM setting, checks whether prospects reference it and, if so, opens a
 * confirmation. `guardRename` resolves true when the confirmation was opened (caller should wait
 * for the user) and false when the save can proceed immediately.
 */
export function useRenameInUseGuard(slug: CrmSettingUsageSlug) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  async function guardRename(id: string): Promise<boolean> {
    setIsChecking(true);
    try {
      const inUse = await fetchUsage(slug, id);
      if (inUse) setConfirmOpen(true);
      return inUse;
    } catch {
      // If the check fails, let the save itself report any error.
      return false;
    } finally {
      setIsChecking(false);
    }
  }

  return { confirmOpen, closeConfirm: () => setConfirmOpen(false), isChecking, guardRename };
}
