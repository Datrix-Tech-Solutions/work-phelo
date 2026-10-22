'use client';

import { useMemo, useState } from 'react';
import { DataCardGrid } from '@/components/organisms/shared/DataCardGrid';
import { ProjectTemplateCard } from '@/components/molecules/hr/projects/ProjectTemplateCard';
import { ProjectTemplatePanel } from '@/components/organisms/hr/projects/ProjectTemplatePanel';
import { useProjectTemplatesStore } from '@/store/projectTemplates.store';
import { useProjectLabels } from '@/hooks/useModuleLabels';
import { CreateProjectTemplateDto, ProjectTemplate } from '@/types/hr';

export default function ProjectTemplatesPage() {
  const labels = useProjectLabels();
  // Only the templates people have created. Scrum and Kanban are offered when starting a project.
  const templates = useProjectTemplatesStore((s) => s.templates);
  const addTemplate = useProjectTemplatesStore((s) => s.addTemplate);
  const updateTemplate = useProjectTemplatesStore((s) => s.updateTemplate);
  const removeTemplate = useProjectTemplatesStore((s) => s.removeTemplate);

  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectTemplate | undefined>();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, search]);

  const openPanel = (template?: ProjectTemplate) => {
    setEditing(template);
    setPanelOpen(true);
  };

  const handleSubmit = (dto: CreateProjectTemplateDto) => {
    if (editing) updateTemplate(editing.id, dto);
    else addTemplate(dto);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      <DataCardGrid
        data={filtered}
        searchPlaceholder="Search templates…"
        searchValue={search}
        onSearch={setSearch}
        actionButton={{ label: 'Create Template', onClick: () => openPanel() }}
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
            onEdit={() => openPanel(template)}
            onDelete={() => removeTemplate(template.id)}
          />
        )}
      />

      <ProjectTemplatePanel
        key={editing?.id ?? 'new'}
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSubmit={handleSubmit}
        template={editing}
      />
    </div>
  );
}
