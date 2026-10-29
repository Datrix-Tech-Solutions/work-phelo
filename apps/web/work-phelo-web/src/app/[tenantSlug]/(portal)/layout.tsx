// TENANT PORTAL LAYOUT — shared TopNav for the Executive Dashboard page

'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { TopNav } from '@/components/organisms/shared/TopNav';
import { AppBackground } from '@/components/atoms/AppBackground';
import { MoodSelectorModal } from '@/components/organisms/shared/MoodSelectorModal';

const PORTAL_BACKGROUNDS = [
  // '/background/backone.jpg',
  // '/background/backtwo.jpg',
  '/background/backthree.jpg',
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? 'User';
  const initials = `${firstName[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();
  // const isTenantAdmin = user?.role === 'TENANT_ADMIN';

  // Picked once per mount (i.e. each fresh visit to the portal, such as after login) so the
  // three photos rotate. Server and client each roll independently, which is an intentional,
  // purely cosmetic hydration mismatch — suppressed on the <Image> in AppBackground.
  const [background] = useState(
    () => PORTAL_BACKGROUNDS[Math.floor(Math.random() * PORTAL_BACKGROUNDS.length)],
  );

  return (
    <AppBackground backgroundImage={background} className="h-dvh overflow-hidden flex flex-col">
      <TopNav userInitials={initials} logoVariant="image" />
      {children}
      <MoodSelectorModal />
    </AppBackground>
  );
}
