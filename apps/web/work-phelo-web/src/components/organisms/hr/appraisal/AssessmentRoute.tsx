'use client';

import { useRouter } from 'next/navigation';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import { useToast } from '@/hooks/useToast';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';
import { useAppraisalGoalsStore } from '@/store/appraisalGoals.store';
import { useAppraisalAssessmentsStore } from '@/store/appraisalAssessments.store';
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
  const assessment = useAppraisalAssessmentsStore((s) =>
    s.assessments.find((a) => a.id === assessmentId),
  );
  const submitSelf = useAppraisalAssessmentsStore((s) => s.submitSelf);
  const submitManager = useAppraisalAssessmentsStore((s) => s.submitManager);
  const cycle = useAppraisalGoalsStore((s) => s.cycles.find((c) => c.id === assessment?.cycleId));
  const { data: employeeData } = useAllEmployees();
  const employee = employeeData?.data?.find((e) => e.id === assessment?.employeeId);

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
          if (mode === 'self') {
            submitSelf(assessment.id, ratings);
            toast.success('Assessment submitted');
          } else {
            submitManager(assessment.id, ratings, comment);
            toast.success('Review submitted');
          }
          router.back();
        }}
      />
    </div>
  );
}
