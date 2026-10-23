'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** Clients now live under the Prospects & Clients page; this keeps old links working. */
export default function Page() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/${tenantSlug}/marketing/prospects/clients`);
  }, [tenantSlug, router]);
  return null;
}
