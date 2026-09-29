'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RequestsPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${tenantSlug}/marketing/requests/all-requests`);
  }, [tenantSlug, router]);

  return null;
}
