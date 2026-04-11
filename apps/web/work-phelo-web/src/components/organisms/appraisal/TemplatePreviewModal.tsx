'use client';

import { Modal } from '@/components/organisms/shared/Modal';
import { cn } from '@/lib/utils';
import { SectionType } from '@/types/appraisal';

interface PreviewSection {
  name: string;
  type: SectionType | '';
  ratingScaleRange?: number;
  isRequired: boolean;
}

interface TemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateName: string;
  sections: PreviewSection[];
}

function RatingInput({ range }: { range: number }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {Array.from({ length: range }, (_, i) => i + 1).map((n) => (
        <div
          key={n}
          className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-sm font-medium text-gray-500 cursor-pointer hover:border-brand hover:text-brand transition-colors"
        >
          {n}
        </div>
      ))}
    </div>
  );
}

function SectionPreview({ section, index }: { section: PreviewSection; index: number }) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <p className="text-sm font-semibold text-gray-900">
          {section.name || 'Untitled Section'}
          {section.isRequired && <span className="text-red-500 ml-1">*</span>}
        </p>
      </div>

      {section.type === 'RatingScale' && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-gray-500">Rate from 1 to {section.ratingScaleRange ?? 5}</p>
          <RatingInput range={section.ratingScaleRange ?? 5} />
        </div>
      )}

      {section.type === 'FreeText' && (
        <textarea
          disabled
          placeholder="Employee writes their response here..."
          rows={3}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-400 bg-white resize-none"
        />
      )}

      {section.type === 'YesNo' && (
        <div className="flex gap-3">
          {['Yes', 'No'].map((opt) => (
            <div
              key={opt}
              className="px-6 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-500 cursor-pointer hover:border-brand hover:text-brand transition-colors"
            >
              {opt}
            </div>
          ))}
        </div>
      )}

      {!section.type && <p className="text-xs text-gray-400 italic">No section type selected</p>}
    </div>
  );
}

export function TemplatePreviewModal({
  isOpen,
  onClose,
  templateName,
  sections,
}: TemplatePreviewModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Template Preview"
      description="This is exactly what employees and managers will see during the appraisal."
      width="max-w-xl"
    >
      <div className="mt-4 flex flex-col gap-3">
        <div className="px-4 py-3 rounded-xl bg-brand/5 border border-brand/10">
          <p className="text-xs text-brand/60 font-medium uppercase tracking-wide">Template</p>
          <p className="text-sm font-semibold text-brand mt-0.5">
            {templateName || 'Untitled Template'}
          </p>
        </div>

        {sections.length === 0 ? (
          <p className={cn('text-sm text-gray-400 text-center py-6')}>No sections added yet</p>
        ) : (
          sections.map((section, i) => <SectionPreview key={i} section={section} index={i} />)
        )}
      </div>
    </Modal>
  );
}
