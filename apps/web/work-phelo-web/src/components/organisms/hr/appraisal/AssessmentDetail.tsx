'use client';

import { useRatingThresholds } from '@/hooks/hr/useRatingThresholds';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/atoms/Button';
import { RatingBadge } from '@/components/molecules/hr/appraisal/RatingBadge';
import { Modal } from '@/components/organisms/shared/Modal';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import { useToast } from '@/hooks/useToast';
import { pageContent } from '@/lib/layout';
import {
  RATING_MAX,
  managerScorePct,
  overallScore,
  ratingForScore,
  selfScorePct,
} from '@/lib/appraisalAssessments';
import { cardClass, cn } from '@/lib/utils';
import {
  useApproveAssessment,
  useAssessment,
  useGoalCycle,
  useRejectAssessment,
} from '@/hooks/hr/useGoalAppraisals';
import { StatusLabel } from './CycleAssessments';

const pct = (value: number | null) => (value === null ? '—' : `${value}%`);

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

/** HR's view of one employee in a cycle: the stats, every objective's ratings, and approve or reject. */
export function AssessmentDetail({
  tenantSlug,
  assessmentId,
}: {
  tenantSlug: string;
  assessmentId: string;
}) {
  const toast = useToast();
  const { assessment, isLoading } = useAssessment(assessmentId);
  const approve = useApproveAssessment();
  const reject = useRejectAssessment();
  const { cycle } = useGoalCycle(assessment?.cycleId ?? '');
  const thresholds = useRatingThresholds();
  const { data: employeeData } = useAllEmployees();

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState('');

  const employee = employeeData?.data?.find((e) => e.id === assessment?.employeeId);
  const manager = employeeData?.data?.find((e) => e.id === employee?.managerId);
  const entries = assessment?.entries ?? [];

  if (isLoading) {
    return <div className={cn(pageContent, 'text-sm text-gray-400')}>Loading…</div>;
  }
  if (!assessment || !cycle) {
    return <div className={cn(pageContent, 'text-sm text-red-500')}>Assessment not found.</div>;
  }

  const name = employee ? `${employee.firstName} ${employee.lastName}` : 'Employee';
  const cycleHref = `/${tenantSlug}/hr/appraisal/cycles/${cycle.id}`;
  const final = overallScore(assessment, entries);
  const rating = ratingForScore(final, thresholds);
  const awaitingHr = assessment.status === 'MANAGER_SUBMITTED';
  const close = () => {
    setApproveOpen(false);
    setRejectOpen(false);
    setNote('');
  };

  return (
    <div className={cn(pageContent, 'flex flex-col gap-6')}>
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={`/${tenantSlug}/hr/appraisal/hr-review`} className="hover:text-gray-600">
          HR Review
        </Link>
        <span>›</span>
        <Link href={cycleHref} className="hover:text-gray-600">
          {cycle.title}
        </Link>
        <span>›</span>
        <span className="text-gray-600">{name}</span>
      </nav>

      <div className={cardClass('px-6 py-5 flex flex-wrap items-start justify-between gap-6')}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{name}</h1>
            <StatusLabel status={assessment.status} />
          </div>
          <p className="text-sm text-gray-500">
            {[
              cycle.title,
              employee?.department?.name,
              manager && `Manager: ${manager.firstName} ${manager.lastName}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {assessment.status === 'FINALIZED' ? (
          <div className="flex items-center gap-8 shrink-0">
            <Stat label="Final Combined Score" value={pct(final)} />
            <Stat label="Performance Band" value={<RatingBadge rating={rating} />} />
          </div>
        ) : awaitingHr ? (
          <div className="flex items-center gap-3 shrink-0">
            <Button variant="outline" onClick={() => setRejectOpen(true)}>
              Reject
            </Button>
            <Button onClick={() => setApproveOpen(true)}>Approve</Button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={cardClass('px-5 py-4')}>
          <Stat label="Self Assessment" value={pct(selfScorePct(assessment, entries))} />
        </div>
        <div className={cardClass('px-5 py-4')}>
          <Stat label="Manager Assessment" value={pct(managerScorePct(assessment, entries))} />
        </div>
        <div className={cardClass('px-5 py-4')}>
          <Stat label="Combined (weighted)" value={pct(final)} />
        </div>
        <div className={cardClass('px-5 py-4')}>
          <Stat label="Rating" value={<RatingBadge rating={rating} />} />
        </div>
      </div>

      <div className={cardClass('overflow-hidden')}>
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">Assessment Results</h2>
        </div>
        <div className="px-6 pb-6 overflow-x-auto">
          {entries.length === 0 ? (
            <p className="py-8 text-sm text-gray-400 text-center">
              No objectives under this cycle&apos;s goals.
            </p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="py-3 pr-4 font-semibold text-gray-700">Objective</th>
                  <th className="py-3 pr-4 font-semibold text-gray-700">Goal</th>
                  <th className="py-3 pr-4 font-semibold text-gray-700">Employee</th>
                  <th className="py-3 pr-4 font-semibold text-gray-700">Manager</th>
                  <th className="py-3 pr-4 font-semibold text-gray-700">Weights</th>
                  <th className="py-3 pr-4 font-semibold text-gray-700">Employee Comment</th>
                  <th className="py-3 font-semibold text-gray-700">Manager Comment</th>
                </tr>
              </thead>
              <tbody>
                {entries.flatMap(({ goal, objectives: list }) =>
                  list.map((o) => {
                    const self = assessment.selfRatings[o.id];
                    const mgr = assessment.managerRatings[o.id];
                    return (
                      <tr key={o.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-4 pr-4 text-gray-900">{o.name}</td>
                        <td className="py-4 pr-4 text-gray-700">{goal.name}</td>
                        <td className="py-4 pr-4 text-gray-700">
                          {self ? `${self.score}/${RATING_MAX}` : '—'}
                        </td>
                        <td className="py-4 pr-4 text-gray-700">
                          {mgr ? `${mgr.score}/${RATING_MAX}` : '—'}
                        </td>
                        <td className="py-4 pr-4 text-gray-700">
                          {goal.selfAssessmentWeight}/{goal.managerAssessmentWeight}
                        </td>
                        <td className="py-4 pr-4 text-gray-500">{self?.comment || '—'}</td>
                        <td className="py-4 text-gray-500">{mgr?.comment || '—'}</td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={cardClass('px-6 py-5 flex flex-col gap-1')}>
          <p className="text-sm font-semibold text-gray-900">Overall Manager Comment</p>
          <p className="text-sm text-gray-500">{assessment.managerComment || '—'}</p>
        </div>
        <div className={cardClass('px-6 py-5 flex flex-col gap-1')}>
          <p className="text-sm font-semibold text-gray-900">Overall HR Note</p>
          <p className="text-sm text-gray-500">{assessment.hrComment || '—'}</p>
        </div>
      </div>

      <Modal
        isOpen={approveOpen}
        onClose={close}
        title="Approve Assessment"
        description={`Finalize ${name}'s assessment? It can't be changed afterwards.`}
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                // The server closes the cycle itself once every assessment in it is approved.
                approve.mutate(
                  { id: assessment.id, note: note.trim() },
                  { onSuccess: () => toast.success('Assessment approved') },
                );
                close();
              }}
            >
              Approve
            </Button>
          </>
        }
      >
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="HR note (optional)"
          className="mt-4 w-full resize-none rounded-input border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </Modal>

      <Modal
        isOpen={rejectOpen}
        onClose={close}
        title="Reject Manager Review"
        description="This sends the manager's review back to be redone."
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!note.trim()}
              onClick={() => {
                reject.mutate(
                  { id: assessment.id, reason: note.trim() },
                  { onSuccess: () => toast.success('Review sent back to the manager') },
                );
                close();
              }}
            >
              Confirm Rejection
            </Button>
          </>
        }
      >
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why is it being sent back?"
          className="mt-4 w-full resize-none rounded-input border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </Modal>
    </div>
  );
}
