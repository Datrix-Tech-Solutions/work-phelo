'use client';

import { useRouter } from 'next/navigation';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import { useToast } from '@/hooks/useToast';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';
import {
  useAssessment,
  useGoalCycle,
  useSubmitManagerReview,
  useSubmitSelfAssessment,
} from '@/hooks/hr/useGoalAppraisals';
import { AssessmentForm, type AssessmentMode } from './AssessmentForm';

/** Finds an assessment from the route and shows it as a self assessment, a manager review, or read-only. */
export function AssessmentRoute({
  assessmentId,
  mode,
}: {
  assessmentId: string;
  mode: AssessmentMode;
}) {
  const router = useRouter();
  const toast = useToast();
  const { assessment, isLoading } = useAssessment(assessmentId);
  const submitSelf = useSubmitSelfAssessment();
  const submitManager = useSubmitManagerReview();
  const { cycle } = useGoalCycle(assessment?.cycleId ?? '');
  const { data: employeeData } = useAllEmployees();
  const employee = employeeData?.data?.find((e) => e.id === assessment?.employeeId);

  if (isLoading) {
    return <div className={cn(pageContent, 'text-sm text-gray-400')}>Loading…</div>;
  }
  if (!assessment || !cycle) {
    return <div className={cn(pageContent, 'text-sm text-gray-400')}>Assessment not found.</div>;
  }

  const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'Employee';

  return (
    <div className={cn(pageContent, 'max-w-3xl')}>
      <AssessmentForm
        key={`${assessment.id}-${mode}`}
        assessment={assessment}
        cycle={cycle}
        employeeName={employeeName}
        mode={mode}
        onCancel={() => router.back()}
        onSubmit={(ratings, comment) => {
          const done = (message: string) => ({
            onSuccess: () => {
              toast.success(message);
              router.back();
            },
          });
          if (mode === 'self') {
            submitSelf.mutate({ id: assessment.id, ratings }, done('Assessment submitted'));
          } else {
            submitManager.mutate({ id: assessment.id, ratings, comment }, done('Review submitted'));
          }
        }}
      />
    </div>
  );
}
