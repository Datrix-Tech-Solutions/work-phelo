'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  BarChart3,
  CalendarClock,
  ListChecks,
  Handshake,
  Megaphone,
  Target,
  Truck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { ReportCard } from '@/components/molecules/shared/ReportCard';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { MARKETING_REPORTS, REPORT_SECTIONS, type ReportSection } from '@/lib/marketing-reports';

const ICONS: Record<string, { icon: React.ReactNode; className: string }> = {
  'client-report': {
    icon: <Handshake className="w-6 h-6" />,
    className: 'bg-sky-600 text-sky-100',
  },
  'prospect-report': {
    icon: <ListChecks className="w-6 h-6" />,
    className: 'bg-blue-600 text-blue-100',
  },
  'target-achievement': {
    icon: <Target className="w-6 h-6" />,
    className: 'bg-fuchsia-600 text-fuchsia-100',
  },
  appointments: {
    icon: <CalendarClock className="w-6 h-6" />,
    className: 'bg-teal-600 text-teal-100',
  },
  'sales-performance': {
    icon: <Users className="w-6 h-6" />,
    className: 'bg-purple-600 text-purple-100',
  },
  'growth-trend': {
    icon: <TrendingUp className="w-6 h-6" />,
    className: 'bg-emerald-600 text-emerald-100',
  },
  'campaign-performance': {
    icon: <Megaphone className="w-6 h-6" />,
    className: 'bg-amber-600 text-amber-100',
  },
  'campaign-trend': {
    icon: <TrendingUp className="w-6 h-6" />,
    className: 'bg-orange-600 text-orange-100',
  },
  'transport-requests': {
    icon: <ListChecks className="w-6 h-6" />,
    className: 'bg-cyan-600 text-cyan-100',
  },
  'vehicle-driver-usage': {
    icon: <Truck className="w-6 h-6" />,
    className: 'bg-rose-600 text-rose-100',
  },
  'transport-trend': {
    icon: <BarChart3 className="w-6 h-6" />,
    className: 'bg-indigo-600 text-indigo-100',
  },
};

/** Marketing's reports: one tab per sub-module, each report a card that opens its own page. */
export default function MarketingReportsPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();

  const access: Record<ReportSection, boolean> = {
    crm: useAnyPermissionRules(['marketing.dashboard:VIEW']),
    campaign: useAnyPermissionRules(['marketing.campaigns:VIEW']),
    transport: useAnyPermissionRules([
      'marketing.requests.all:VIEW',
      'marketing.requests.all:APPROVE',
    ]),
  };
  // A report shows when its section is open to the caller, or when it is open to every marketer.
  const visible = MARKETING_REPORTS.filter((r) => access[r.section] || r.open);
  const sections = REPORT_SECTIONS.filter((s) => visible.some((r) => r.section === s.key));
  const [picked, setPicked] = useState<ReportSection | null>(null);
  const active = sections.find((s) => s.key === picked)?.key ?? sections[0]?.key;

  return (
    <div className="flex flex-col gap-6 py-6 pr-6 pl-(--page-pl) min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Reports</h2>
      </div>

      {!active ? (
        <p className="text-sm text-gray-500 py-8 text-center">No reports are available to you.</p>
      ) : (
        <>
          <TabBar
            tabs={sections}
            activeTab={active}
            onTabChange={(t) => setPicked(t as ReportSection)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible
              .filter((r) => r.section === active)
              .map((report) => (
                <ReportCard
                  key={report.key}
                  icon={ICONS[report.key]?.icon}
                  iconClassName={ICONS[report.key]?.className}
                  title={report.title}
                  description={report.description}
                  onClick={() => router.push(`/${tenantSlug}/marketing/reports/${report.key}`)}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
}
