'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';

/**
 * Hiring has no page of its own — each section is a page with its own sidebar entry
 * (recruitment/layout.tsx). This root sends the viewer to the first one they can access.
 */
export default function RecruitmentPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canViewJobOpenings = usePermission(Permission.READ_RECRUITMENT_VACANCIES);
  const canViewCandidates = usePermission(Permission.READ_RECRUITMENT_CANDIDATES);
  const canViewConfigurations = usePermission(Permission.READ_RECRUITMENT_STAGES);

  useEffect(() => {
    if (user === null) return;
    const base = `/${tenantSlug}/hr/recruitment`;
    if (canViewJobOpenings) router.replace(`${base}/job-openings`);
    else if (canViewCandidates) router.replace(`${base}/candidates`);
    else if (canViewConfigurations) router.replace(`${base}/configurations`);
    else router.replace(`/${tenantSlug}/hr`);
  }, [user, tenantSlug, canViewJobOpenings, canViewCandidates, canViewConfigurations, router]);

  return null;
}
