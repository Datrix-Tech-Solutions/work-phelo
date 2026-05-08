'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnnouncementsContent } from '@/components/organisms/announcements/AnnouncementsContent';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';

export default function AnnouncementsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const canReadAnnouncements = usePermission(Permission.READ_ANNOUNCEMENTS);
  const canManageAnnouncements = usePermission(Permission.MANAGE_ANNOUNCEMENTS);
  const canAccessAnnouncements = canReadAnnouncements || canManageAnnouncements;

  useEffect(() => {
    if (canAccessAnnouncements === false) {
      router.replace(`/${tenantSlug}/hr`);
    }
  }, [canAccessAnnouncements, router, tenantSlug]);

  if (!canAccessAnnouncements) return null;

  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <AnnouncementsContent />
    </div>
  );
}
