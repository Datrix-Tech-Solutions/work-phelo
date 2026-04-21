// APPRAISAL PAGE //

'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppraisalHeader } from '@/components/molecules/appraisal/AppraisalHeader';
import { SelfAssessmentColumn } from '@/components/organisms/appraisal/SelfAssessmentColumn';
import { ManagerReviewColumn } from '@/components/organisms/appraisal/ManagerReviewColumn';

export default function EmployeeAppraisalDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cycleId: string; employeeAppraisalId: string }>;
}) {
  const { tenantSlug, cycleId, employeeAppraisalId } = use(params);

  const { data: appraisal } = useQuery({
    queryKey: ['employee-appraisal', employeeAppraisalId],
    queryFn: () => api.get(`/hr/appraisals/${employeeAppraisalId}`).then((r) => r.data),
  });

  const { data: cycle } = useQuery({
    queryKey: ['appraisal-cycle', cycleId],
    queryFn: () => api.get(`/hr/appraisals/cycles/${cycleId}`).then((r) => r.data),
  });

  const { data: kpis = [] } = useQuery({
    queryKey: ['cycle-kpis', cycleId],
    queryFn: () => api.get(`/hr/appraisals/cycles/${cycleId}/kpis`).then((r) => r.data),
  });

  if (!appraisal) {
    return (
      <div className="p-8">
        <p className="text-red-500">Appraisal not found.</p>
        <Link
          href={`/${tenantSlug}/hr/appraisal/cycles/${cycleId}/results`}
          className="text-brand hover:underline mt-4 inline-block"
        >
          ← Back to Results
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6 min-h-full">
      <AppraisalHeader
        tenantSlug={tenantSlug}
        cycleId={cycleId}
        cycleTitle={cycle?.title}
        employeeName={`${appraisal.employee?.firstName} ${appraisal.employee?.lastName}`}
        overallStatus={appraisal.overallStatus}
      />

      <div className="flex flex-col lg:flex-row gap-6 flex-1">
        <SelfAssessmentColumn
          self={appraisal.selfResponse}
          kpis={kpis}
          sections={appraisal.sections || []}
        />

        <div className="hidden lg:block w-px bg-gray-200 shrink-0" />
        <div className="block lg:hidden h-px bg-gray-200 w-full shrink-0" />

        <ManagerReviewColumn
          manager={appraisal.managerResponse}
          kpis={kpis}
          sections={appraisal.sections || []}
          finalized={appraisal.finalizedAppraisal}
        />
      </div>
    </div>
  );
}
