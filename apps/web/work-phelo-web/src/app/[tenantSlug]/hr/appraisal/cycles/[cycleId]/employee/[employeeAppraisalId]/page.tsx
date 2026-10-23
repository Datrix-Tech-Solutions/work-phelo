'use client';

import { use } from 'react';
import { AssessmentDetail } from '@/components/organisms/hr/appraisal/AssessmentDetail';

export default function EmployeeAppraisalDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; employeeAppraisalId: string }>;
}) {
  const { tenantSlug, employeeAppraisalId } = use(params);
  return <AssessmentDetail tenantSlug={tenantSlug} assessmentId={employeeAppraisalId} />;
}
