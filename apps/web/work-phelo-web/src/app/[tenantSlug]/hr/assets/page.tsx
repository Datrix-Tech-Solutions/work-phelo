'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';
import { AssetsContent } from '@/components/organisms/assets/AssetsContent';

export default function AssetsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const canManageAssets = usePermission(Permission.MANAGE_ASSETS);

  useEffect(() => {
    if (canManageAssets === false) {
      router.replace(`/${tenantSlug}/hr`);
    }
  }, [canManageAssets, tenantSlug, router]);

  if (!canManageAssets) return null;

  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <AssetsContent />
    </div>
  );
}
