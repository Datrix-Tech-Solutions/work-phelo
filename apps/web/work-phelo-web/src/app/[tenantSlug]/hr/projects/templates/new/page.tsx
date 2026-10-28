'use client';

import { use } from 'react';
import { ProjectTemplateEditor } from '@/components/organisms/hr/projects/ProjectTemplateEditor';

export default function NewProjectTemplatePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  return <ProjectTemplateEditor listHref={`/${tenantSlug}/hr/projects/templates`} />;
}
