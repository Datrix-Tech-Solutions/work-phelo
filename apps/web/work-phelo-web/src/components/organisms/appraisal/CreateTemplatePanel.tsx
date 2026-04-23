'use client';

import { useEffect } from 'react';
import { extractError } from '@/lib/extractError';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/shared/FormField';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { inputClass } from '@/lib/utils';
import { AppraisalTemplate, CreateAppraisalTemplateDto } from '@/types/hr';
import { Icons } from '@/components/atoms/icons';

interface CreateTemplatePanelProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  editTemplate?: AppraisalTemplate;
}

type KpiFormValue = {
  title: string;
  weight: number | '';
  maxScore: number | '';
  description: string;
};

type FormValues = {
  name: string;
  selfAssessmentWeight: number | '';
  managerAssessmentWeight: number | '';
  kpis: KpiFormValue[];
};

export function CreateTemplatePanel({
  isOpen,
  onClose,
  tenantSlug,
  editTemplate,
}: CreateTemplatePanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!editTemplate;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      selfAssessmentWeight: '',
      managerAssessmentWeight: '',
      kpis: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'kpis' });

  useEffect(() => {
    if (editTemplate) {
      reset({
        name: editTemplate.name,
        selfAssessmentWeight: editTemplate.selfAssessmentWeight,
        managerAssessmentWeight: editTemplate.managerAssessmentWeight,
        kpis: editTemplate.kpis.map((k) => ({
          title: k.title,
          weight: k.weight,
          maxScore: k.maxScore,
          description: k.description ?? '',
        })),
      });
    } else {
      reset({
        name: '',
        selfAssessmentWeight: '',
        managerAssessmentWeight: '',
        kpis: [],
      });
    }
  }, [editTemplate, reset, isOpen]);

  const selfWeight = Number(useWatch({ control, name: 'selfAssessmentWeight' }) || 0);
  const managerWeight = Number(useWatch({ control, name: 'managerAssessmentWeight' }) || 0);
  const totalWeight = selfWeight + managerWeight;
  const weightIsValid = totalWeight === 100;

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateAppraisalTemplateDto) =>
      isEditing
        ? api.put(`/hr/appraisals/templates/${editTemplate!.id}`, data)
        : api.post(`/hr/appraisals/templates`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-templates', tenantSlug] });
      toast.success(isEditing ? 'Template updated' : 'Template created');
      onClose();
    },
    onError: (err) => {
      toast.error(extractError(err, 'Something went wrong'));
    },
  });

  const onSubmit = (values: FormValues) => {
    if (!weightIsValid) {
      toast.error('Self and manager assessment weights must add up to 100%');
      return;
    }
    if (values.kpis.length === 0) {
      toast.error('Add at least one KPI');
      return;
    }
    mutate({
      tenantSlug,
      name: values.name,
      selfAssessmentWeight: Number(values.selfAssessmentWeight),
      managerAssessmentWeight: Number(values.managerAssessmentWeight),
      kpis: values.kpis.map((k) => ({
        title: k.title,
        weight: Number(k.weight),
        maxScore: Number(k.maxScore),
        description: k.description || undefined,
      })),
    });
  };

  const addKpi = () => append({ title: '', weight: '', maxScore: '', description: '' });

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Template' : 'Add Appraisal Template'}
      description="Define KPI-based templates for performance reviews."
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving..." onClick={handleSubmit(onSubmit)}>
            Save
          </Button>
        </div>
      }
    >
      {/* Template Details */}
      <div className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-gray-800">Template Details</p>

        <FormField
          label="Template Name"
          registration={register('name', { required: 'Template name is required' })}
          error={errors.name}
          placeholder="eg; Annual Performance Review"
        />

        <Controller
          name="selfAssessmentWeight"
          control={control}
          rules={{
            required: 'Required',
            min: { value: 0, message: 'Min 0' },
            max: { value: 100, message: 'Max 100' },
          }}
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Self Assessment Weight (%)
              </label>
              <Input
                type="number"
                placeholder="40"
                error={errors.selfAssessmentWeight?.message}
                {...field}
                onChange={(e) =>
                  field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>
          )}
        />

        <Controller
          name="managerAssessmentWeight"
          control={control}
          rules={{
            required: 'Required',
            min: { value: 0, message: 'Min 0' },
            max: { value: 100, message: 'Max 100' },
          }}
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Manager Assessment Weight (%)
              </label>
              <Input
                type="number"
                placeholder="60"
                error={errors.managerAssessmentWeight?.message}
                {...field}
                onChange={(e) =>
                  field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>
          )}
        />

        <div
          className={`px-4 py-2.5 rounded-lg text-sm font-medium ${
            weightIsValid
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-gray-50 text-gray-500 border border-gray-200'
          }`}
        >
          Total Assessment Weight: {totalWeight} of 100%
        </div>
      </div>

      {/* KPIs */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-800">Key Performance Indicators</p>

        {fields.map((field, index) => {
          const kpiErrors = errors.kpis?.[index];
          return (
            <div
              key={field.id}
              className="flex flex-col gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Add KPI
                </p>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                  aria-label="Remove KPI"
                >
                  <Icons.X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">KPI Title</label>
                <Input
                  placeholder="eg; Standard Appraisal"
                  error={kpiErrors?.title?.message}
                  {...register(`kpis.${index}.title`, { required: 'KPI title is required' })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Weight (%)</label>
                  <Input
                    type="number"
                    placeholder="eg; 30"
                    error={kpiErrors?.weight?.message}
                    {...register(`kpis.${index}.weight`, {
                      required: 'Required',
                      min: { value: 1, message: 'Min 1' },
                    })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Max Score</label>
                  <Input
                    type="number"
                    placeholder="eg; 10"
                    error={kpiErrors?.maxScore?.message}
                    {...register(`kpis.${index}.maxScore`, {
                      required: 'Required',
                      min: { value: 1, message: 'Min 1' },
                    })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Description</label>
                <textarea
                  placeholder="Describe what this KPI measures"
                  rows={3}
                  className={inputClass(undefined, 'resize-none')}
                  {...register(`kpis.${index}.description`)}
                />
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addKpi}
          className="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          <Icons.Plus className="w-4 h-4" />
          Add KPI
        </button>
      </div>
    </SidePanel>
  );
}
