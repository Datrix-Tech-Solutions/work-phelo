'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function InventoryUserManagementPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${tenantSlug}/operations/inventory/user-management/roles-permissions`);
  }, [router, tenantSlug]);

  return null;
}
