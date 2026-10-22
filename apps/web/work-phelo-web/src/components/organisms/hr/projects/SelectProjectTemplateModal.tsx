'use client';

import { FilePlus2, LayoutTemplate } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { useProjectTemplates } from '@/hooks/hr/useProjectTemplates';
import { useProjectLabels } from '@/hooks/useModuleLabels';
import { ProjectTemplate } from '@/types/hr';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** `null` is the blank slate: nothing prefilled, nothing saved as a template. */
  onSelect: (template: ProjectTemplate | null) => void;
}

export function SelectProjectTemplateModal({ isOpen, onClose, onSelect }: Props) {
  const labels = useProjectLabels();
  const { templates } = useProjectTemplates();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Choose a template"
      description={`Pick a template to set up your new ${labels.singularLower}.`}
      width="max-w-2xl"
    >
      <div className="flex flex-col gap-2">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(null);
            }
          }}
          className="flex items-start gap-3 rounded-xl border border-dashed border-gray-300 p-3 cursor-pointer transition-colors hover:border-(--module-border,var(--color-purple-100)) hover:bg-gray-50"
        >
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <FilePlus2 className="w-5 h-5 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <p className="text-base font-bold text-gray-900">Blank</p>
            <p className="text-sm text-gray-500">
              {`Start from scratch and set up this ${labels.singularLower} yourself. It's used for this ${labels.singularLower} only and isn't saved as a template.`}
            </p>
          </div>
        </div>
        {templates.map((t) => (
          <div
            key={t.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(t)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(t);
              }
            }}
            className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer transition-colors hover:border-(--module-border,var(--color-purple-100)) hover:bg-gray-50"
          >
            <div className="w-10 h-10 rounded-lg bg-brand-tint flex items-center justify-center shrink-0">
              <LayoutTemplate className="w-5 h-5 text-brand" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <p className="text-base font-bold text-gray-900">{t.name}</p>
              {t.description && <p className="text-sm text-gray-500">{t.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
