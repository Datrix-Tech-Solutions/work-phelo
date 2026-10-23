'use client';

import { use } from 'react';
import { AssessmentRoute } from '@/components/organisms/hr/appraisal/AssessmentRoute';

export default function Page({ params }: { params: Promise<{ employeeAppraisalId: string }> }) {
  const { employeeAppraisalId } = use(params);
  return <AssessmentRoute assessmentId={employeeAppraisalId} mode="manager" />;
}
