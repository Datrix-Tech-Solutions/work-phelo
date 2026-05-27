'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useHrManagementAccess } from '@/hooks/hr/useHrManagementAccess';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';

const TABS = [
  { label: 'Employment & Resignation', slug: 'employment' },
  { label: 'Appraisal Cycle Recipients', slug: 'recipients' },
  { label: 'Company Agreements', slug: 'agreements' },
  { label: 'Finances', slug: 'finances' },
];

export default function CompanyPoliciesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { canReadHrSettings } = useHrManagementAccess();
  const canManagePayroll = usePermission(Permission.RUN_PAYROLL);
  const base = `/${params.tenantSlug}/hr/hrmanagement/companyPolicies`;

  const isOnFinances = pathname === `${base}/finances` || pathname.startsWith(`${base}/finances/`);

  useEffect(() => {
    if (user === null) return;
    // Payroll-only users without HR settings access land on the finances sub-page.
    // All other tabs are viewable by everyone, so no further redirect is needed.
    if (!canReadHrSettings && canManagePayroll && !isOnFinances) {
      router.replace(`${base}/finances`);
    }
  }, [canReadHrSettings, canManagePayroll, isOnFinances, router, user, base]);

  return (
    <div className="flex flex-col">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Company Policies</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure default HR policies for your organisation
        </p>
      </div>

      {/* Tab bar — horizontally scrollable on mobile, scrollbar hidden */}
      <div className="border-b border-gray-200 shrink-0 mt-4">
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          <div className="flex items-end gap-1 min-w-max">
            {TABS.filter((tab) =>
              tab.slug === 'finances' ? canManagePayroll || canReadHrSettings : true,
            ).map((tab) => {
              const href = `${base}/${tab.slug}`;
              const isActive = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={tab.slug}
                  href={href}
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
        </div>
      </div>

      <div className="flex flex-col pt-6">{children}</div>
    </div>
  );
}
