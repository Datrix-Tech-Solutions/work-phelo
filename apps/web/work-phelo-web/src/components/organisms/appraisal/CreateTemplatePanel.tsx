'use client';

import { useRef, useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SidePanel } from '@/components/organisms/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { TemplatePreviewModal } from '@/components/organisms/appraisal/TemplatePreviewModal';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { AppraisalTemplate, CreateAppraisalTemplateDto, SectionType } from '@/types/appraisal';

interface CreateTemplatePanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  editTemplate?: AppraisalTemplate;
}

type SectionFormValue = {
  name: string;
  type: SectionType | '';
  ratingScaleRange: number | '';
  isRequired: boolean;
  order: number;
};

type FormValues = {
  name: string;
  sections: SectionFormValue[];
};

const SECTION_TYPES = [
  { value: 'RatingScale', label: 'Rating Scale' },
  { value: 'FreeText', label: 'Free Text' },
  { value: 'YesNo', label: 'Yes / No' },
];

const RATING_RANGES = [
  { value: '3', label: '1 to 3' },
  { value: '5', label: '1 to 5' },
  { value: '10', label: '1 to 10' },
];

/* ── Drag-handle icon ── */
function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gray-300">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

/* ── Section row ── */
function SectionRow({
  index,
  control,
  register,
  errors,
  watchType,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
}: {
  index: number;
  control: ReturnType<typeof useForm<FormValues>>['control'];
  register: ReturnType<typeof useForm<FormValues>>['register'];
  errors: ReturnType<typeof useForm<FormValues>>['formState']['errors'];
  watchType: SectionType | '';
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  isDragOver: boolean;
}) {
  const sectionErrors = errors.sections?.[index];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        'flex flex-col gap-3 p-4 rounded-xl border transition-colors',
        isDragOver ? 'border-[#0D2244] bg-[#0D2244]/5' : 'border-gray-200 bg-gray-50',
      )}
    >
      {/* Row header */}
      <div className="flex items-center gap-2">
        <div className="cursor-grab active:cursor-grabbing p-1 hover:text-gray-500 transition-colors">
          <GripIcon />
        </div>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Section {index + 1}
        </span>
        <div className="flex-1" />
        {/* Required toggle */}
        <Controller
          name={`sections.${index}.isRequired`}
          control={control}
          render={({ field }) => (
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <span className="text-xs text-gray-500">Required</span>
              <div
                onClick={() => field.onChange(!field.value)}
                className={cn(
                  'w-8 h-4 rounded-full transition-colors relative',
                  field.value ? 'bg-[#0D2244]' : 'bg-gray-200',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform',
                    field.value ? 'translate-x-4' : 'translate-x-0.5',
                  )}
                />
              </div>
            </label>
          )}
        />
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-gray-300 hover:text-red-400 transition-colors"
          aria-label="Remove section"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Section name */}
      <Input
        placeholder="e.g. KPI Scoring, Competency Ratings..."
        error={sectionErrors?.name?.message}
        {...register(`sections.${index}.name`, { required: 'Section name is required' })}
      />

      {/* Type + Range row */}
      <div className="grid grid-cols-2 gap-3">
        <Controller
          name={`sections.${index}.type`}
          control={control}
          rules={{ required: 'Type is required' }}
          render={({ field }) => (
            <SearchSelect
              placeholder="Section type"
              options={SECTION_TYPES}
              value={field.value}
              onChange={field.onChange}
              error={sectionErrors?.type?.message}
            />
          )}
        />

        {watchType === 'RatingScale' && (
          <Controller
            name={`sections.${index}.ratingScaleRange`}
            control={control}
            rules={{ required: 'Range is required' }}
            render={({ field }) => (
              <SearchSelect
                placeholder="Scale range"
                options={RATING_RANGES}
                value={String(field.value ?? '')}
                onChange={(v) => field.onChange(Number(v))}
                error={sectionErrors?.ratingScaleRange?.message}
              />
            )}
          />
        )}
      </div>
    </div>
  );
}

/* ── Main panel ── */
export function CreateTemplatePanel({
  isOpen,
  onClose,
  tenantSlug,
  editTemplate,
}: CreateTemplatePanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!editTemplate;
  const [previewOpen, setPreviewOpen] = useState(false);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { name: '', sections: [] },
  });

  const { fields, append, remove, move } = useFieldArray({ control, name: 'sections' });

  // Populate form when editing
  useEffect(() => {
    if (editTemplate) {
      reset({
        name: editTemplate.name,
        sections: editTemplate.sections
          .sort((a, b) => a.order - b.order)
          .map((s) => ({
            name: s.name,
            type: s.type,
            ratingScaleRange: s.ratingScaleRange ?? '',
            isRequired: s.isRequired,
            order: s.order,
          })),
      });
    } else {
      reset({ name: '', sections: [] });
    }
  }, [editTemplate, reset]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedSections = watch('sections');

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateAppraisalTemplateDto) =>
      isEditing
        ? api.put(`/${tenantSlug}/appraisal/templates/${editTemplate!.id}`, data)
        : api.post(`/${tenantSlug}/appraisal/templates`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-templates', tenantSlug] });
      toast.success(isEditing ? 'Template updated' : 'Template created');
      onClose();
    },
    onError: (err) => {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'Something went wrong';
      toast.error(message);
    },
  });

  const onSubmit = (values: FormValues) => {
    if (values.sections.length === 0) {
      toast.error('Add at least one section');
      return;
    }
    mutate({
      tenantSlug,
      name: values.name,
      sections: values.sections.map((s, i) => ({
        name: s.name,
        type: s.type as SectionType,
        ratingScaleRange: s.type === 'RatingScale' ? Number(s.ratingScaleRange) : undefined,
        isRequired: s.isRequired,
        order: i + 1,
      })),
    });
  };

  const addSection = () =>
    append({
      name: '',
      type: '',
      ratingScaleRange: '',
      isRequired: false,
      order: fields.length + 1,
    });

  return (
    <>
      <SidePanel
        isOpen={isOpen}
        onClose={onClose}
        title={isEditing ? 'Edit Template' : 'New Appraisal Template'}
        description="Define sections that employees and managers fill in during a review."
        width="w-[580px]"
        footer={
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              Preview
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button isLoading={isPending} loadingText="Saving..." onClick={handleSubmit(onSubmit)}>
              {isEditing ? 'Save Changes' : 'Create Template'}
            </Button>
          </div>
        }
      >
        {/* Template name */}
        <FormField
          label="Template Name"
          registration={register('name', { required: 'Template name is required' })}
          error={errors.name}
          placeholder="e.g. Standard Performance Review"
        />

        {/* Sections */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">Sections</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Drag to reorder. Minimum one section required.
              </p>
            </div>
            <button
              type="button"
              onClick={addSection}
              className="flex items-center gap-1.5 text-sm text-[#0D2244] font-medium hover:opacity-70 transition-opacity"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Section
            </button>
          </div>

          {fields.length === 0 && (
            <div
              onClick={addSection}
              className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-gray-200 cursor-pointer hover:border-gray-300 transition-colors"
            >
              <p className="text-sm text-gray-400">No sections yet</p>
              <p className="text-xs text-gray-300">Click to add your first section</p>
            </div>
          )}

          {fields.map((field, index) => (
            <SectionRow
              key={field.id}
              index={index}
              control={control}
              register={register}
              errors={errors}
              watchType={watchedSections[index]?.type ?? ''}
              onRemove={() => remove(index)}
              onDragStart={() => {
                dragIndexRef.current = index;
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIndex(index);
              }}
              onDrop={() => {
                if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
                  move(dragIndexRef.current, index);
                }
                dragIndexRef.current = null;
                setDragOverIndex(null);
              }}
              isDragOver={dragOverIndex === index}
            />
          ))}

          {fields.length > 0 && (
            <button
              type="button"
              onClick={addSection}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-gray-300 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Another Section
            </button>
          )}
        </div>
      </SidePanel>

      <TemplatePreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        templateName={watch('name')}
        sections={watchedSections.map((s) => ({
          ...s,
          ratingScaleRange: s.ratingScaleRange === '' ? undefined : s.ratingScaleRange,
        }))}
      />
    </>
  );
}
