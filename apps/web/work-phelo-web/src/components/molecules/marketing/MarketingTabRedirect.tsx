'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMarketingAccess } from '@/hooks/marketing/useMarketingAccess';

/** Opens a multi-tab page on the first tab the user is allowed to see. */
export function MarketingTabRedirect({ page }: { page: string }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const { firstTab, isResolving } = useMarketingAccess();
  const tab = firstTab(page);

  useEffect(() => {
    if (isResolving || !tab) return;
    router.replace(`/${tenantSlug}/marketing/${page}/${tab}`);
  }, [isResolving, tab, tenantSlug, page, router]);

  return null;
}
