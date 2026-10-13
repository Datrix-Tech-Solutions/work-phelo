'use client';

import { useParams } from 'next/navigation';
import { TabBar } from '@/components/molecules/shared/TabBar';

const TABS = [
  { key: 'employment', label: 'Employment & Resignation', slug: 'employment' },
  { key: 'agreements', label: 'Company Agreements', slug: 'agreements' },
];

export default function CompanyPoliciesLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ tenantSlug: string }>();
  const base = `/${params.tenantSlug}/hr/hrmanagement/companyPolicies`;

  return (
    <div className="flex flex-col">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Company Policies</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure default HR policies for your organisation
        </p>
      </div>

      {/* Tab bar */}
      <TabBar
        className="mt-4"
        tabs={TABS.map(({ key, label, slug }) => ({ key, label, href: `${base}/${slug}` }))}
      />

      <div className="flex flex-col pt-6">{children}</div>
    </div>
  );
}
