'use client';

import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import {
  ProjectConfigFields,
  getProjectConfigErrors,
} from '@/components/molecules/hr/projects/ProjectConfigFields';
import { BLANK_PROJECT_CONFIG } from '@/lib/defaultProjectTemplates';
import { pickConfig } from '@/lib/projectConfig';
import { inputClass } from '@/lib/utils';
import { CreateProjectTemplateDto, ProjectConfig, ProjectTemplate } from '@/types/hr';
import { useProjectLabels } from '@/hooks/useModuleLabels';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProjectTemplateDto) => void;
  /** The template being edited; leave out to create a new one. Remount (key) when it changes. */
  template?: ProjectTemplate;
}

type FormValues = {
  name: string;
  description: string;
  config: ProjectConfig;
};

export function ProjectTemplatePanel({ isOpen, onClose, onSubmit, template }: Props) {
  const labels = useProjectLabels();
  const isEditing = !!template;
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitted },
  } = useForm<FormValues>({
    defaultValues: template
      ? {
          name: template.name,
          description: template.description ?? '',
          config: pickConfig(template),
        }
      : { name: '', description: '', config: BLANK_PROJECT_CONFIG },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onValid = (values: FormValues) => {
    onSubmit({
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      ...values.config,
    });
    handleClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? `Edit ${template.name}` : 'New Template'}
      description={`Set up the workflow, work types, features and priority levels for new ${labels.pluralLower}.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onValid)}>
            {isEditing ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
      }
    >
      {/* Tighter than the panel's default gap-6 between fields. */}
      <div className="flex flex-col gap-3">
        <FormField
          label="Template Name"
          registration={register('name', { required: 'Template name is required' })}
          error={errors.name}
          placeholder="e.g. Marketing Campaign"
        />

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            {...register('description')}
            placeholder="What is this template for?"
            rows={3}
            className={inputClass(undefined, 'resize-none')}
          />
        </div>

        <Controller
          name="config"
          control={control}
          rules={{ validate: (v) => Object.keys(getProjectConfigErrors(v)).length === 0 }}
          render={({ field }) => (
            <ProjectConfigFields
              value={field.value}
              onChange={field.onChange}
              showErrors={isSubmitted}
            />
          )}
        />
      </div>
    </SidePanel>
  );
}
