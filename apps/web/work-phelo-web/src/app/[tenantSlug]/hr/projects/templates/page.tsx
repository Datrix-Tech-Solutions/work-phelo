'use client';

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataCardGrid } from '@/components/organisms/shared/DataCardGrid';
import { ProjectTemplateCard } from '@/components/molecules/hr/projects/ProjectTemplateCard';
import { useProjectTemplates, useRemoveProjectTemplate } from '@/hooks/hr/useProjectTemplates';
import { useSaveWithToast } from '@/hooks/hr/useProjectWork';
import { useProjectLabels } from '@/hooks/useModuleLabels';

export default function ProjectTemplatesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const labels = useProjectLabels();
  // Only the templates people have created. Scrum and Kanban are offered when starting a project.
  const { custom: templates } = useProjectTemplates();
  const removeTemplate = useRemoveProjectTemplate();
  const save = useSaveWithToast();

  const [search, setSearch] = useState('');
  const base = `/${tenantSlug}/hr/projects/templates`;
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, search]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      <DataCardGrid
        data={filtered}
        searchPlaceholder="Search templates…"
        searchValue={search}
        onSearch={setSearch}
        actionButton={{ label: 'Create Template', onClick: () => router.push(`${base}/new`) }}
        gridClassName="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-4"
        emptyMessage={
          templates.length === 0
            ? `No ${labels.singularLower} templates yet`
            : `No ${labels.singularLower} templates found`
        }
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        renderCard={(template) => (
          <ProjectTemplateCard
            template={template}
            featureLabels={template.content.featureLabels}
            onEdit={() => router.push(`${base}/${template.id}`)}
            onDelete={() => save(removeTemplate.mutateAsync(template.id))}
          />
        )}
      />
    </div>
  );
}
