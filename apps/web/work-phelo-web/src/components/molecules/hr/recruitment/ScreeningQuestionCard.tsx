'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { TagInput } from '@/components/atoms/TagInput';
import { Toggle } from '@/components/atoms/Toggle';
import { cn, inputClass } from '@/lib/utils';
import type { JobOpeningAnswerType, JobOpeningQuestionRow } from '@/types/recruitment';

interface Props {
  question: JobOpeningQuestionRow;
  index: number;
  answerTypeOptions: { value: JobOpeningAnswerType; label: string }[];
  /** Whether this question's answer type takes a list of options. */
  hasOptions: boolean;
  error?: string;
  onChange: (patch: Partial<JobOpeningQuestionRow>) => void;
  onRemove: () => void;
}

/** One screening question, draggable by its handle within a dnd-kit SortableContext. */
export function ScreeningQuestionCard({
  question,
  index,
  answerTypeOptions,
  hasOptions,
  error,
  onChange,
  onRemove,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-4',
        isDragging && 'opacity-60 shadow-lg relative z-50',
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex flex-1 min-w-0 items-stretch gap-3">
            <button
              type="button"
              {...attributes}
              {...listeners}
              aria-label="Drag to reorder"
              className="flex shrink-0 cursor-grab touch-none items-center justify-center rounded-input border border-(--input-border,var(--color-gray-400)) px-1 text-gray-400 transition-colors hover:text-gray-600 active:cursor-grabbing"
            >
              <GripVertical className="w-4 h-4" />
            </button>
            <input
              type="text"
              placeholder={`Question ${index + 1}`}
              value={question.question}
              onChange={(e) => onChange({ question: e.target.value })}
              className={inputClass()}
            />
          </div>
          <div className="sm:w-56 shrink-0">
            <SearchSelect
              placeholder="Answer type"
              options={answerTypeOptions}
              value={question.answerType}
              clearable={false}
              onChange={(v) => onChange({ answerType: v as JobOpeningAnswerType })}
            />
          </div>
        </div>

        {hasOptions && (
          <TagInput
            placeholder="Type an option and press Enter"
            value={question.options}
            onChange={(options) => onChange({ options })}
            error={error}
          />
        )}

        <div className="flex items-center justify-end gap-4">
          <label className="flex items-center gap-2 text-xs text-gray-600">
            Required
            <Toggle enabled={question.required} onChange={(required) => onChange({ required })} />
          </label>
          <button
            type="button"
            aria-label="Remove question"
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
