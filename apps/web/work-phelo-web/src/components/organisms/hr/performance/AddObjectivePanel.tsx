'use client';

import { useEffect } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { SegmentedToggle } from '@/components/atoms/SegmentedToggle';
import { FormField } from '@/components/molecules/shared/FormField';
import { useProjectLabels } from '@/hooks/useModuleLabels';

export interface ObjectiveInput {
  name: string;
  projectId?: string;
  projectName?: string;
  kpis: string[];
}

interface FormValues {
  name: string;
  linkedToProject: 'yes' | 'no';
  projectId: string;
  kpis: { value: string }[];
}

const EMPTY: FormValues = { name: '', linkedToProject: 'no', projectId: '', kpis: [{ value: '' }] };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Projects the person is assigned to. With none, the project field is disabled. */
  projects: { id: string; name: string }[];
  onSave: (objective: ObjectiveInput) => void;
}

export function AddObjectivePanel({ isOpen, onClose, projects, onSave }: Props) {
  const labels = useProjectLabels();
  const form = useForm<FormValues>({ defaultValues: EMPTY });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'kpis' });
  const linked = useWatch({ control: form.control, name: 'linkedToProject' });
  const hasProjects = projects.length > 0;

  useEffect(() => {
    if (isOpen) form.reset(EMPTY);
  }, [isOpen, form]);

  const submit = form.handleSubmit((data) => {
    const project =
      data.linkedToProject === 'yes' ? projects.find((p) => p.id === data.projectId) : undefined;
    onSave({
      name: data.name.trim(),
      projectId: project?.id,
      projectName: project?.name,
      kpis: data.kpis.map((k) => k.value.trim()).filter(Boolean),
    });
    onClose();
  });

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Add Objective"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Save Objective</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Objective Name"
          registration={form.register('name', { required: 'Required' })}
          error={form.formState.errors.name}
          placeholder="eg; Improve customer response time"
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-700">
            {labels.singular} <span className="font-normal text-gray-400">(optional)</span>
          </span>
          <Controller
            control={form.control}
            name="linkedToProject"
            render={({ field }) => (
              <div className={hasProjects ? undefined : 'pointer-events-none opacity-50'}>
                <SegmentedToggle
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { label: 'No', value: 'no' },
                    { label: 'Yes', value: 'yes' },
                  ]}
                />
              </div>
            )}
          />
          {!hasProjects && (
            <p className="text-xs text-gray-400">Not assigned to any {labels.pluralLower}.</p>
          )}
        </div>

        {hasProjects && linked === 'yes' && (
          <Controller
            control={form.control}
            name="projectId"
            rules={{ required: 'Required' }}
            render={({ field, fieldState }) => (
              <SearchSelect
                label={`${labels.singular} Name`}
                placeholder={`Select ${labels.singularLower}`}
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
        )}

        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">KPIs</p>
          {fields.map((item, index) => (
            <div key={item.id} className="flex items-end gap-2">
              <div className="flex-1">
                <FormField
                  label={`KPI ${index + 1}`}
                  registration={form.register(`kpis.${index}.value`)}
                  placeholder="eg; Average response under 2 hours"
                />
              </div>
              {fields.length > 1 && (
                <Button variant="outline" onClick={() => remove(index)} aria-label="Remove KPI">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          <div>
            <Button variant="outline" onClick={() => append({ value: '' })}>
              <Plus className="w-4 h-4" /> Add KPI
            </Button>
          </div>
        </div>
      </div>
    </SidePanel>
  );
}
