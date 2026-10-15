'use client';

import { useState } from 'react';
import { CalendarClock, MapPin, Users, Video, Phone, type LucideIcon } from 'lucide-react';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { Badge, type BadgeProps } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { Modal } from '@/components/organisms/shared/Modal';
import { CompleteInterviewModal } from './CompleteInterviewModal';
import { useToast } from '@/hooks/useToast';
import { useUpdateInterviewStatus } from '@/hooks/hr/useRecruitment';
import { extractError } from '@/lib/extractError';
import { formatDateTime } from './candidateUtils';
import type {
  CandidateInterview,
  InterviewMode,
  InterviewStatus,
  RecruitmentStage,
} from '@/types/recruitment';

const MODE_LABELS: Record<InterviewMode, { label: string; icon: LucideIcon }> = {
  IN_PERSON: { label: 'In person', icon: Users },
  VIDEO: { label: 'Video call', icon: Video },
  PHONE: { label: 'Phone call', icon: Phone },
};

const STATUS_BADGES: Record<InterviewStatus, { label: string; variant: BadgeProps['variant'] }> = {
  SCHEDULED: { label: 'Scheduled', variant: 'info' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
};

interface Props {
  candidateId: string;
  interviews: CandidateInterview[];
  isLoading?: boolean;
  /** Whether the user may complete or cancel interviews. */
  canManage?: boolean;
  stages?: RecruitmentStage[];
  currentStageId?: string | null;
}

export function CandidateInterviewsTab({
  candidateId,
  interviews,
  isLoading,
  canManage = false,
  stages = [],
  currentStageId = null,
}: Props) {
  const toast = useToast();
  const { mutate: updateStatus, isPending: isCancelling } = useUpdateInterviewStatus();
  const [completing, setCompleting] = useState<CandidateInterview | null>(null);
  const [cancelling, setCancelling] = useState<CandidateInterview | null>(null);

  const confirmCancel = () => {
    if (!cancelling) return;
    updateStatus(
      { candidateId, interviewId: cancelling.id, status: 'CANCELLED' },
      {
        onSuccess: () => {
          toast.success('Interview cancelled');
          setCancelling(null);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to cancel interview')),
      },
    );
  };

  if (isLoading) {
    return <div className="h-40 rounded-card bg-gray-200 animate-pulse" />;
  }

  return (
    <>
      <SectionCard title="Interviews">
        {interviews.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            No interviews have been scheduled for this candidate.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100">
            {interviews.map((iv) => {
              const mode = MODE_LABELS[iv.mode];
              const status = STATUS_BADGES[iv.status];
              return (
                <li key={iv.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{iv.title}</p>
                    <Badge label={status.label} variant={status.variant} />
                    {canManage && iv.status === 'SCHEDULED' && (
                      <div className="ml-auto flex items-center gap-2">
                        <TableButton variant="green" onClick={() => setCompleting(iv)}>
                          Complete
                        </TableButton>
                        <TableButton variant="red" onClick={() => setCancelling(iv)}>
                          Cancel
                        </TableButton>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {formatDateTime(iv.scheduledAt)} · {iv.durationMinutes} min
                    </span>
                    <span className="flex items-center gap-1.5">
                      <mode.icon className="h-3.5 w-3.5" />
                      {mode.label}
                    </span>
                    {(iv.platform || iv.meetingLink) && (
                      <span className="flex items-center gap-1.5">
                        <Video className="h-3.5 w-3.5" />
                        {iv.meetingLink ? (
                          <a
                            href={iv.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-gray-800"
                          >
                            {iv.platform ?? 'Join meeting'}
                          </a>
                        ) : (
                          iv.platform
                        )}
                      </span>
                    )}
                    {iv.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {iv.phone}
                      </span>
                    )}
                    {iv.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {iv.location}
                      </span>
                    )}
                    {iv.interviewers.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {iv.interviewers.join(', ')}
                      </span>
                    )}
                  </div>
                  {iv.notes && <p className="mt-3 text-sm text-gray-600">{iv.notes}</p>}
                  {iv.feedback && (
                    <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      {iv.feedback}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <CompleteInterviewModal
        candidateId={candidateId}
        interview={completing}
        stages={stages}
        currentStageId={currentStageId}
        onClose={() => setCompleting(null)}
      />

      <Modal
        isOpen={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Cancel Interview"
        description="Cancel this interview? If the candidate has no other interview booked, they move back to Screening."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCancelling(null)}>
              Keep Interview
            </Button>
            <Button
              variant="danger"
              isLoading={isCancelling}
              loadingText="Cancelling…"
              onClick={confirmCancel}
            >
              Cancel Interview
            </Button>
          </div>
        }
      />
    </>
  );
}
