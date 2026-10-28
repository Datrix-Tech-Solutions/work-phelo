'use client';

import { use } from 'react';
import { ProjectTemplateEditor } from '@/components/organisms/hr/projects/ProjectTemplateEditor';
import { useProjectTemplates } from '@/hooks/hr/useProjectTemplates';

export default function EditProjectTemplatePage({
  params,
}: {
  params: Promise<{ tenantSlug: string; templateId: string }>;
}) {
  const { tenantSlug, templateId } = use(params);
  const { custom, isLoading } = useProjectTemplates();
  const template = custom.find((t) => t.id === templateId);
  const listHref = `/${tenantSlug}/hr/projects/templates`;

  if (isLoading) return null;
  if (!template) {
    return <p className="p-8 text-sm text-gray-500">This template no longer exists.</p>;
  }
  return <ProjectTemplateEditor key={template.id} listHref={listHref} template={template} />;
}
