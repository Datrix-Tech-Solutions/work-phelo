'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { getActiveOperationsFeature } from '@/config/operations-features';

export default function OperationsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const authLoading = useAuthStore((s) => s.isLoading);
  const featureConfig = useAuthStore((s) => s.user?.featureConfig);

  useEffect(() => {
    if (authLoading) return;
    const feature = getActiveOperationsFeature(featureConfig);
    router.replace(feature ? `/${tenantSlug}/operations/${feature.segment}` : `/${tenantSlug}/hr`);
  }, [authLoading, featureConfig, router, tenantSlug]);

  return null;
}
