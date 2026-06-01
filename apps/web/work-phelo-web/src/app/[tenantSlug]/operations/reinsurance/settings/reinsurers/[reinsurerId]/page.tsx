'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { StatCard } from '@/components/atoms/StatCard';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { useReinsurers } from '@/hooks';
import { EditReinsurancePanel } from '@/components/organisms/reinsurance/panels/EditReinsurancePanel';
import { ReinsurerInfoCard } from '@/components/molecules/reinsurance/ReinsurerInfoCard';
import { PremiumTrendChart } from '@/components/molecules/reinsurance/PremiumTrendChart';
import {
  ReinsurerPoliciesTable,
  type ReinsurerPolicy,
} from '@/components/molecules/reinsurance/ReinsurerPoliciesTable';

/* ── Placeholder until API provides per-reinsurer policy data ── */
const EMPTY_POLICIES: ReinsurerPolicy[] = [];

export default function ReinsurerDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; reinsurerId: string }>;
}) {
  const { tenantSlug, reinsurerId } = use(params);
  const { data: reinsurers = [], isLoading } = useReinsurers();
  const reinsurer = reinsurers.find((r) => r.id === reinsurerId) ?? null;

  const [editOpen, setEditOpen] = useState(false);

  const settingsBase = `/${tenantSlug}/operations/reinsurance/settings/reinsurers`;

  /* ── Derived stats from policies ── */
  const policies = EMPTY_POLICIES;
  const accepted = policies.filter((p) => p.status === 'Closed' || p.status === 'Active').length;
  const pending = policies.filter((p) => p.status === 'Open' || p.status === 'Pending').length;
  const rejected = policies.filter(
    (p) => p.status === 'Cancelled' || p.status === 'Rejected' || p.status === 'Expired',
  ).length;
  const total = accepted + rejected;
  const acceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Breadcrumb */}
      <div className={`${pageBreadcrumb} shrink-0`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={settingsBase} className="hover:text-gray-700 transition-colors">
            Reinsurers
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">{reinsurer?.name ?? '—'}</span>
        </nav>
      </div>

      {/* Content */}
      <div className={`${pageContent} flex-1 overflow-y-auto`}>
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Loading…
          </div>
        ) : !reinsurer ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Reinsurer not found.
          </div>
        ) : (
          <div className="flex gap-6 items-start">
            {/* Left: info card (fixed width) */}
            <div className="w-72 shrink-0">
              <ReinsurerInfoCard reinsurer={reinsurer} onUpdate={() => setEditOpen(true)} />
            </div>

            {/* Right: stats + chart + table */}
            <div className="flex-1 min-w-0 flex flex-col gap-6">
              {/* Stat cards */}
              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  label="Accepted Offers"
                  value={accepted}
                  sub="Closed & active placements"
                />
                <StatCard label="Pending Offers" value={pending} sub="Awaiting response" />
                <StatCard
                  label="Rejected Offers"
                  value={rejected}
                  sub="Cancelled, rejected or expired"
                />
                <StatCard
                  label="Acceptance Rate"
                  value={acceptanceRate !== null ? `${acceptanceRate}%` : '—'}
                  sub="Accepted / total decided"
                />
              </div>

              {/* Premium trend */}
              <div className="rounded-2xl border border-gray-100 bg-white p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Premium Ceded Trend</h3>
                <PremiumTrendChart data={[]} />
              </div>

              {/* Policies table */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-gray-900">Policies &amp; Treaties</h3>
                <ReinsurerPoliciesTable data={policies} />
              </div>
            </div>
          </div>
        )}
      </div>

      <EditReinsurancePanel
        reinsurer={editOpen ? reinsurer : null}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}
