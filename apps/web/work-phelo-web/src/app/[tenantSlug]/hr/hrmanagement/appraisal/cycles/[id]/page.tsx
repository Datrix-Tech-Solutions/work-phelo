// HR MANAGEMENT APPRAISAL CYCLE PAGE //

'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { Modal } from '@/components/organisms/Modal';
import { Button } from '@/components/atoms/Button';
import { CreateKpiPanel } from '@/components/organisms/appraisal/CreateKpiPanel';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { AppraisalCycle, AppraisalKpi } from '@/types/appraisal';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  );
}

function WeightBar({ kpis }: { kpis: AppraisalKpi[] }) {
  const total = kpis.reduce((s, k) => s + k.weight, 0);
  const isComplete = total === 100;
  const isOver = total > 100;

  return (
    <div className="flex items-center gap-4 px-5 py-3 rounded-xl border bg-gray-50">
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="flex justify-between text-xs font-medium">
          <span className="text-gray-500">Total KPI weight</span>
          <span
            className={cn(
              'font-bold',
              isOver ? 'text-red-500' : isComplete ? 'text-green-600' : 'text-orange-500',
            )}
          >
            {total}% / 100%
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isOver ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-orange-400',
            )}
            style={{ width: `${Math.min(total, 100)}%` }}
          />
        </div>
      </div>
      <span
        className={cn(
          'text-xs font-semibold px-2.5 py-1 rounded-full',
          isComplete ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-600',
        )}
      >
        {isComplete ? 'Balanced' : isOver ? 'Over 100%' : `${100 - total}% remaining`}
      </span>
    </div>
  );
}

export default function CycleDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'kpis'>('overview');
  const [kpiPanelOpen, setKpiPanelOpen] = useState(false);
  const [editKpi, setEditKpi] = useState<AppraisalKpi | undefined>();
  const [deleteKpi, setDeleteKpi] = useState<AppraisalKpi | null>(null);

  const { data: cycle, isLoading: cycleLoading } = useQuery<AppraisalCycle>({
    queryKey: ['appraisal-cycle', id],
    queryFn: () => api.get(`/hr/appraisals/cycles/${id}`).then((r) => r.data),
  });

  const { data: kpis = [], isLoading: kpisLoading } = useQuery<AppraisalKpi[]>({
    queryKey: ['cycle-kpis', id],
    queryFn: () => api.get(`/hr/appraisals/cycles/${id}/kpis`).then((r) => r.data),
  });

  const { mutate: deleteKpiMutation, isPending: isDeleting } = useMutation({
    mutationFn: (kpiId: string) => api.delete(`/hr/appraisals/cycles/${id}/kpis/${kpiId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-kpis', id] });
      toast.success('KPI removed');
      setDeleteKpi(null);
    },
    onError: (err) => {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'Failed to remove KPI';
      toast.error(message);
    },
  });

  const usedWeight = kpis.filter((k) => k.id !== editKpi?.id).reduce((s, k) => s + k.weight, 0);

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'kpis', label: `KPIs${kpis.length > 0 ? ` (${kpis.length})` : ''}` },
  ] as const;

  if (cycleLoading) {
    return <div className="p-8 text-sm text-gray-400">Loading...</div>;
  }

  if (!cycle) {
    return <div className="p-8 text-sm text-red-400">Cycle not found.</div>;
  }

  const canEditKpis = cycle.status === 'Upcoming' || cycle.status === 'InProgress';

  return (
    <>
      {/* Header */}
      <div className="px-8 pt-6 pb-0 flex flex-col gap-4">
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
              <h1 className="text-xl font-semibold text-gray-900">{cycle.name}</h1>
              <StatusBadge status={cycle.status} />
            </div>
            <p className="text-sm text-gray-500">
              {cycle.frequency} · {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-end gap-1 border-b border-gray-200 -mx-8 px-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'relative px-4 py-3 text-sm transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'text-[#0D2244] font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#0D2244] after:rounded-t-full'
                  : 'text-gray-500 hover:text-gray-800',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-8">
        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 gap-x-12 gap-y-6 max-w-2xl">
            <DetailRow label="Frequency" value={cycle.frequency} />
            <DetailRow label="Status" value={<StatusBadge status={cycle.status} />} />
            <DetailRow label="Start Date" value={formatDate(cycle.startDate)} />
            <DetailRow label="End Date" value={formatDate(cycle.endDate)} />
            <DetailRow
              label="Self Assessment Deadline"
              value={formatDate(cycle.selfAssessmentDeadline)}
            />
            <DetailRow
              label="Manager Review Deadline"
              value={formatDate(cycle.managerReviewDeadline)}
            />
            <DetailRow
              label="Applies To"
              value={
                cycle.isAllDepartments
                  ? 'All Employees'
                  : `${cycle.targetDepartmentIds.length} department(s)`
              }
            />
            <DetailRow label="Template" value={cycle.templateId} />
            {cycle.description && (
              <div className="col-span-2">
                <DetailRow label="Description" value={cycle.description} />
              </div>
            )}
            {cycle.cancellationReason && (
              <div className="col-span-2">
                <DetailRow
                  label="Cancellation Reason"
                  value={<span className="text-red-600">{cycle.cancellationReason}</span>}
                />
              </div>
            )}
          </div>
        )}

        {/* ── KPIs ── */}
        {activeTab === 'kpis' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">KPIs</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Define the performance objectives for this cycle. Weights must sum to 100%.
                </p>
              </div>
              {canEditKpis && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditKpi(undefined);
                    setKpiPanelOpen(true);
                  }}
                >
                  Add KPI
                </Button>
              )}
            </div>

            {kpis.length > 0 && <WeightBar kpis={kpis} />}

            {kpisLoading ? (
              <p className="text-sm text-gray-400">Loading KPIs...</p>
            ) : kpis.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border-2 border-dashed border-gray-200">
                <p className="text-sm text-gray-400">No KPIs yet</p>
                {canEditKpis && (
                  <button
                    onClick={() => {
                      setEditKpi(undefined);
                      setKpiPanelOpen(true);
                    }}
                    className="text-sm text-[#0D2244] font-medium hover:opacity-70 transition-opacity"
                  >
                    Add the first KPI
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {kpis.map((kpi) => (
                  <div
                    key={kpi.id}
                    className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-colors"
                  >
                    <div className="flex-1 flex flex-col gap-1">
                      <p className="text-sm font-semibold text-gray-900">{kpi.title}</p>
                      {kpi.description && (
                        <p className="text-xs text-gray-500">{kpi.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-gray-500">
                          Weight: <span className="font-semibold text-gray-800">{kpi.weight}%</span>
                        </span>
                        <span className="text-xs text-gray-500">
                          Max Score:{' '}
                          <span className="font-semibold text-gray-800">{kpi.maxScore}</span>
                        </span>
                        <span className="text-xs text-gray-500">
                          Self:{' '}
                          <span className="font-semibold text-[#0D2244]">{kpi.selfWeight}%</span>
                          {' / '}
                          Manager:{' '}
                          <span className="font-semibold text-orange-500">
                            {kpi.managerWeight}%
                          </span>
                        </span>
                      </div>
                    </div>
                    {canEditKpis && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setEditKpi(kpi);
                            setKpiPanelOpen(true);
                          }}
                          className="text-xs text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteKpi(kpi)}
                          className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPI panel */}
      <CreateKpiPanel
        isOpen={kpiPanelOpen}
        onClose={() => {
          setKpiPanelOpen(false);
          setEditKpi(undefined);
        }}
        tenantSlug={tenantSlug}
        cycleId={id}
        editKpi={editKpi}
        usedWeight={usedWeight}
      />

      {/* Delete KPI modal */}
      <Modal
        isOpen={!!deleteKpi}
        onClose={() => setDeleteKpi(null)}
        title="Remove KPI"
        description={`Remove "${deleteKpi?.title}" from this cycle? This cannot be undone.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteKpi(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Removing..."
              onClick={() => deleteKpi && deleteKpiMutation(deleteKpi.id)}
            >
              Remove
            </Button>
          </>
        }
      />
    </>
  );
}
