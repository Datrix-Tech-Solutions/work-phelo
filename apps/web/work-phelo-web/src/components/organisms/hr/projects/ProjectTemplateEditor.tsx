'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { StepProgressBar } from '@/components/atoms/StepProgressBar';
import { FormField } from '@/components/molecules/shared/FormField';
import { getProjectConfigErrors } from '@/components/molecules/hr/projects/ProjectConfigFields';
import { TemplateStarterStep } from '@/components/organisms/hr/projects/TemplateStarterStep';
import { TemplateSetupStep } from '@/components/organisms/hr/projects/TemplateSetupStep';
import { useAddProjectTemplate, useUpdateProjectTemplate } from '@/hooks/hr/useProjectTemplates';
import { useSaveWithToast } from '@/hooks/hr/useProjectWork';
import { useProjectLabels } from '@/hooks/useModuleLabels';
import { BLANK_PROJECT_CONFIG, EMPTY_TEMPLATE_CONTENT } from '@/lib/defaultProjectTemplates';
import { pickConfig } from '@/lib/projectConfig';
import { cardClass, inputClass } from '@/lib/utils';
import type { ProjectConfig, ProjectTemplate, ProjectTemplateContent } from '@/types/hr';

interface Props {
  /** Where the templates list lives, to go back to after saving or cancelling. */
  listHref: string;
  /** The template being edited; leave out to create a new one. */
  template?: ProjectTemplate;
}

const STEPS = ['Details', 'Setup', 'Starter content'];

type FormValues = {
  name: string;
  description: string;
  config: ProjectConfig;
  content: ProjectTemplateContent;
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cardClass('p-6 flex flex-col gap-4')}>
      <div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** The full-page form for creating or editing a project template. */
export function ProjectTemplateEditor({ listHref, template }: Props) {
  const router = useRouter();
  const labels = useProjectLabels();
  const isEditing = !!template;
  const save = useSaveWithToast();
  const addTemplate = useAddProjectTemplate();
  const updateTemplate = useUpdateProjectTemplate();
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [showConfigErrors, setShowConfigErrors] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    trigger,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: template?.name ?? '',
      description: template?.description ?? '',
      config: template ? pickConfig(template) : BLANK_PROJECT_CONFIG,
      content: template?.content ?? EMPTY_TEMPLATE_CONTENT,
    },
  });

  const onValid = async ({ name, description, config, content }: FormValues) => {
    const dto = {
      name: name.trim(),
      description: description.trim() || undefined,
      ...config,
      content,
    };
    setIsSaving(true);
    try {
      const saved = await save(
        template
          ? updateTemplate.mutateAsync({ id: template.id, dto })
          : addTemplate.mutateAsync(dto),
      );
      if (!saved) return;
      router.push(listHref);
    } finally {
      setIsSaving(false);
    }
  };

  const next = async () => {
    if (step === 0 && !(await trigger('name'))) return;
    if (step === 1) {
      setShowConfigErrors(true);
      if (!(await trigger('config'))) return;
    }
    setStep((n) => n + 1);
  };

  const isLast = step === STEPS.length - 1;

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back to templates"
          onClick={() => router.push(listHref)}
          className="inline-flex items-center justify-center h-9 w-9 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isEditing ? `Edit ${template.name}` : 'New Template'}
          </h1>
          <p className="text-sm text-gray-500">
            Set up how new {labels.pluralLower} are run and what they start with.
          </p>
        </div>
      </div>

      <div className={`flex flex-col gap-6 w-full ${step > 0 ? 'max-w-7xl' : 'max-w-4xl'}`}>
        <StepProgressBar steps={STEPS} currentStep={step} card />

        {step === 0 && (
          <Section title="Details" description="What this template is called and what it is for.">
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
          </Section>
        )}

        {step === 1 && (
          <Controller
            name="config"
            control={control}
            rules={{ validate: (v) => Object.keys(getProjectConfigErrors(v)).length === 0 }}
            render={({ field }) => (
              <TemplateSetupStep
                name={watch('name')}
                config={field.value}
                onConfigChange={field.onChange}
                content={watch('content')}
                onContentChange={(content) => setValue('content', content)}
                showErrors={showConfigErrors}
              />
            )}
          />
        )}

        {step === 2 && (
          <TemplateStarterStep
            name={watch('name')}
            config={watch('config')}
            content={watch('content')}
            onContentChange={(content) => setValue('content', content)}
          />
        )}

        <div className="flex justify-between gap-3">
          <Button
            variant="secondary"
            onClick={() => (step === 0 ? router.push(listHref) : setStep((n) => n - 1))}
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {isLast ? (
            <Button onClick={handleSubmit(onValid)} isLoading={isSaving}>
              {isEditing ? 'Save Changes' : 'Create Template'}
            </Button>
          ) : (
            <Button onClick={next}>Next</Button>
          )}
        </div>
      </div>
    </div>
  );
}
