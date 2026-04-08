// HR MANAGEMENT APPRAISAL CYCLE DETAIL PAGE //

'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/atoms/Badge';
import { api } from '@/lib/api';
import { AppraisalCycle } from '@/types/appraisal';
import { formatDate } from '@/lib/formatters';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="text-sm text-gray-900">
        {value ?? <span className="text-gray-400">—</span>}
      </div>
    </div>
  );
}

export default function CycleDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);

  const { data: cycles = [], isLoading } = useQuery<AppraisalCycle[]>({
    queryKey: ['appraisal-cycles', tenantSlug],
    queryFn: () =>
      api.get(`/hr/appraisals/cycles`).then((r) => {
        const res = r.data;
        return Array.isArray(res) ? res : (res?.data ?? res?.cycles ?? []);
      }),
  });

  const cycle = cycles.find((c) => c.id === id);

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-400">Loading...</div>;
  }

  if (!cycle) {
    return <div className="p-8 text-sm text-red-400">Cycle not found.</div>;
  }

  return (
    <>
      {/* Header */}
      <div className="px-8 pt-6 pb-8 flex flex-col gap-4">
        <Link
          href={`/${tenantSlug}/hr/hrmanagement/appraisal/cycles`}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors w-fit"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Cycles
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">{cycle.title}</h1>
              <Badge
                variant={cycle.isActive ? 'success' : 'neutral'}
                label={cycle.isActive ? 'Active' : 'Inactive'}
              />
            </div>
            <p className="text-sm text-gray-500">
              {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
            </p>
          </div>
        </div>

        {/* Overview */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-6 max-w-2xl mt-4">
          <DetailRow label="Start Date" value={formatDate(cycle.startDate)} />
          <DetailRow label="End Date" value={formatDate(cycle.endDate)} />
          <DetailRow
            label="Status"
            value={
              <Badge
                variant={cycle.isActive ? 'success' : 'neutral'}
                label={cycle.isActive ? 'Active' : 'Inactive'}
              />
            }
          />
          <DetailRow label="Appraisals" value={cycle._count?.appraisals ?? 0} />
          {cycle.description && (
            <div className="col-span-2">
              <DetailRow label="Description" value={cycle.description} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
