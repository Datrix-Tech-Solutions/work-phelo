'use client';
import { ClientsProspectsChart } from '@/components/molecules/marketing/ClientsProspectsChart';
import { CampaignStatsRow } from '@/components/molecules/marketing/CampaignStatsRow';
import { FleetSnapshotCard } from '@/components/molecules/marketing/FleetSnapshotCard';
import { PipelineStageCards } from '@/components/molecules/marketing/PipelineStageCards';
import { RevenueByProductChart } from '@/components/molecules/marketing/RevenueByProductChart';
import { TargetsOverviewCard } from '@/components/molecules/marketing/TargetsOverviewCard';
import { TransportRequestsChart } from '@/components/molecules/marketing/TransportRequestsChart';
import { MarketingDashboardKpis } from '@/components/organisms/marketing/MarketingDashboardKpis';
import { PendingApprovalCard } from '@/components/organisms/marketing/PendingApprovalCard';
import { TransportAttentionCard } from '@/components/organisms/marketing/TransportAttentionCard';
import { TripsTodayCard } from '@/components/organisms/marketing/TripsTodayCard';
import { DashboardShell } from '@/components/organisms/shared/DashboardShell';
import { useAnyPermissionRules, usePermissionRule } from '@/hooks/hr/usePermission';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';
const SALES_HUE = '#2a78d6';
const TRANSPORT_HUE = '#eb6834';
const CAMPAIGNS_HUE = '#8b5cf6';
/** Tints the cards inside toward a section's hue without affecting the grid they sit in. */
function Hue({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="section-hue contents" style={{ '--hue': color } as React.CSSProperties}>
      {children}
    </div>
  );
}
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}
/** The Marketing overview: CRM, Transport and Campaign figures together. Each section needs the
 * same permission as the dashboard it comes from, so a user sees only what they can read. */
export default function MarketingDashboardPage() {
  const filters = useDashboardFilters();
  const canViewCrm = usePermissionRule('marketing.dashboard:VIEW');
  const canViewTransport = useAnyPermissionRules([
    'marketing.requests.all:VIEW',
    'marketing.requests.all:APPROVE',
  ]);
  const canViewCampaigns = usePermissionRule('marketing.campaigns:VIEW');
  return (
    <DashboardShell filters={filters}>
      <Group title="Overview">
        <div className="flex flex-col gap-3">
          {canViewCrm && (
            <Hue color={SALES_HUE}>
              <MarketingDashboardKpis period={filters.period} year={filters.year} />
              <PipelineStageCards period={filters.period} year={filters.year} />
            </Hue>
          )}
          {canViewCampaigns && (
            <Hue color={CAMPAIGNS_HUE}>
              <CampaignStatsRow />
            </Hue>
          )}
        </div>
      </Group>
      {(canViewCrm || canViewTransport) && (
        <Group title="Charts">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-20 gap-3">
            {canViewCrm && (
              <Hue color={SALES_HUE}>
                <ClientsProspectsChart period={filters.period} className="lg:col-span-10" />
              </Hue>
            )}
            {canViewTransport && (
              <Hue color={TRANSPORT_HUE}>
                <TransportRequestsChart period={filters.period} className="lg:col-span-10" />
              </Hue>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-20 gap-3">
            {canViewCrm && (
              <Hue color={SALES_HUE}>
                <RevenueByProductChart
                  period={filters.period}
                  year={filters.year}
                  className="lg:col-span-7"
                />
              </Hue>
            )}
            {canViewTransport && (
              <Hue color={TRANSPORT_HUE}>
                <FleetSnapshotCard
                  period={filters.period}
                  year={filters.year}
                  className="lg:col-span-6"
                />
              </Hue>
            )}
            {canViewCrm && (
              <Hue color={SALES_HUE}>
                <TargetsOverviewCard
                  period={filters.period}
                  year={filters.year}
                  className="lg:col-span-7"
                />
              </Hue>
            )}
          </div>
        </Group>
      )}
      {canViewTransport && (
        <Group title="Activity">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-20 gap-3">
            <Hue color={TRANSPORT_HUE}>
              <PendingApprovalCard
                period={filters.period}
                year={filters.year}
                className="md:col-span-2 lg:col-span-7"
              />
              <TripsTodayCard
                period={filters.period}
                year={filters.year}
                className="md:col-span-2 lg:col-span-7"
              />
              <TransportAttentionCard
                period={filters.period}
                year={filters.year}
                className="md:col-span-2 lg:col-span-6"
              />
            </Hue>
          </div>
        </Group>
      )}
    </DashboardShell>
  );
}
