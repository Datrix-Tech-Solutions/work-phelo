'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function TransportOfficersPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${tenantSlug}/marketing/transport-officers/details`);
  }, [tenantSlug, router]);

  return null;
}
