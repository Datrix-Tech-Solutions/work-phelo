'use client';

import { AnnouncementsContent } from '@/components/organisms/announcements/AnnouncementsContent';

export default function AnnouncementsPage() {
  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <AnnouncementsContent />
    </div>
  );
}
