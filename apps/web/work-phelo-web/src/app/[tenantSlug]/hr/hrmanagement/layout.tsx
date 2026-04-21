// HR MANAGEMENT PAGE LAYOUT //

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useHrManagementAccess } from '@/hooks/useHrManagementAccess';

interface TabItem {
  label: string;
  href: string;
}

interface TabGroup {
  tabs: TabItem[];
}

function ManagementTabs({ groups }: { groups: TabGroup[] }) {
  const pathname = usePathname();

  return (
    <div className="flex items-end gap-1 px-8 border-b border-gray-200 bg-white">
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-end">
          {/* Divider between groups */}
          {gi > 0 && <div className="self-center mx-2 w-px h-4 bg-gray-200 shrink-0" />}

          {group.tabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'relative px-4 py-3 text-sm transition-colors whitespace-nowrap',
                  isActive
                    ? 'text-brand font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand after:rounded-t-full'
                    : 'text-gray-500 hover:text-gray-800',
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function HRManagementLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const base = `/${params.tenantSlug}/hr/hrmanagement`;
  const {
    canManageLeaveTypes,
    canConfigureAppraisal,
    canAccessRoles,
    hasAnyManagementAccess,
  } = useHrManagementAccess();

  useEffect(() => {
    if (user !== null && !hasAnyManagementAccess) {
      router.replace(`/${params.tenantSlug}/hr`);
    }
  }, [hasAnyManagementAccess, params.tenantSlug, router, user]);

  const groups: TabGroup[] = [
    {
      tabs: canManageLeaveTypes
        ? [
            { label: 'Leave Types', href: `${base}/leave-types` },
            { label: 'Public Holidays', href: `${base}/public-holidays` },
          ]
        : [],
    },
    {
      tabs: canConfigureAppraisal
        ? [
            { label: 'Appraisal Templates', href: `${base}/appraisal/templates` },
            { label: 'Appraisal Cycles', href: `${base}/appraisal/cycles` },
          ]
        : [],
    },
    {
      tabs: canAccessRoles
        ? [{ label: 'Roles & Permissions', href: `${base}/roles` }]
        : [],
    },
  ].filter((group) => group.tabs.length > 0);

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="px-8 pt-8 pb-5 bg-white shrink-0">
        <h1 className="text-xl font-semibold text-gray-900">HR Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure leave types, appraisal templates, cycles, and roles
        </p>
      </div>

      {/* Tabs */}
      <ManagementTabs groups={groups} />

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
