'use client';

import { use } from 'react';
import { AppraisalTemplatesList } from '@/components/organisms/appraisal/AppraisalTemplatesList';

export default function AppraisalTemplatesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Appraisal Templates</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Build reusable templates with sections for rating, free text, and yes/no questions
        </p>
      </div>
      <AppraisalTemplatesList tenantSlug={tenantSlug} />
    </div>
  );
}
