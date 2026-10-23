'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

/** HR's entry point: everyone opens on their own home page. */
export default function HrEntryPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user === null) return;
    router.replace(`/${tenantSlug}/hr/home`);
  }, [user, tenantSlug, router]);

  return null;
}
