import { LayoutTemplate } from 'lucide-react';
import { ProjectTemplate } from '@/types/hr';
import { ProjectTemplateSummary } from '@/components/molecules/hr/projects/ProjectTemplateSummary';
import { DataCard, DataCardAction } from '@/components/organisms/shared/DataCard';

interface Props {
  template: ProjectTemplate;
  onEdit?: () => void;
  onDelete?: () => void;
  /** A built-in template that has been edited; offers a reset back to how it shipped. */
  isEdited?: boolean;
  onReset?: () => void;
}

export function ProjectTemplateCard({ template, onEdit, onDelete, isEdited, onReset }: Props) {
  const actions: DataCardAction[] = [];
  if (onReset) {
    actions.push({
      label: 'Reset',
      onClick: onReset,
      className: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
    });
  }
  if (onDelete) {
    actions.push({
      label: 'Delete',
      onClick: onDelete,
      className: 'bg-red-50 text-red-600 hover:bg-red-100',
    });
  }

  return (
    <DataCard
      onClick={onEdit}
      className="min-h-64"
      icon={
        <div className="w-12 h-12 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
          <LayoutTemplate className="w-6 h-6 text-brand" />
        </div>
      }
      title={template.name}
      titleClassName="text-2xl font-bold"
      centerHeader
      badge={
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
          {template.isDefault ? (isEdited ? 'Default · Edited' : 'Default') : 'Custom'}
        </span>
      }
      note={
        <div className="flex flex-col gap-4">
          {template.description && (
            <p className="text-sm text-gray-600 leading-relaxed">{template.description}</p>
          )}
          <ProjectTemplateSummary template={template} />
        </div>
      }
      actions={actions}
    />
  );
}
