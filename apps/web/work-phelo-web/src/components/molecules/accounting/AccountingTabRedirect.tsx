'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccountingAccess } from '@/hooks/accounting/useAccountingAccess';

/** Opens a multi-tab page on the first tab the user is allowed to see. */
export function AccountingTabRedirect({ page }: { page: string }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const { firstTab, isResolving } = useAccountingAccess();
  const tab = firstTab(page);

  useEffect(() => {
    if (isResolving || !tab) return;
    router.replace(`/${tenantSlug}/accounting/${page}/${tab}`);
  }, [isResolving, tab, tenantSlug, page, router]);

  return null;
}
