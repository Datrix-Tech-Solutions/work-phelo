'use client';

import { useEffect, useMemo } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { SegmentedToggle } from '@/components/atoms/SegmentedToggle';
import { FormField } from '@/components/molecules/shared/FormField';
import { useProjectLabels } from '@/hooks/useModuleLabels';
import { useProjectWorkStore } from '@/store/projectWork.store';

export interface ObjectiveInput {
  name: string;
  projectId?: string;
  projectName?: string;
  /** One of the chosen project's own objectives this one works towards. */
  projectObjectiveId?: string;
  projectObjectiveName?: string;
  kpis: string[];
}

interface FormValues {
  name: string;
  linkedToProject: 'yes' | 'no';
  projectId: string;
  projectObjectiveId: string;
  kpis: { value: string }[];
}

const EMPTY: FormValues = {
  name: '',
  linkedToProject: 'no',
  projectId: '',
  projectObjectiveId: '',
  kpis: [{ value: '' }],
};

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
  const projectId = useWatch({ control: form.control, name: 'projectId' });
  const hasProjects = projects.length > 0;

  const allProjectObjectives = useProjectWorkStore((s) => s.objectives);
  const projectObjectives = useMemo(
    () => allProjectObjectives.filter((o) => o.projectId === projectId),
    [allProjectObjectives, projectId],
  );

  useEffect(() => {
    if (isOpen) form.reset(EMPTY);
  }, [isOpen, form]);

  const submit = form.handleSubmit((data) => {
    const project =
      data.linkedToProject === 'yes' ? projects.find((p) => p.id === data.projectId) : undefined;
    const projectObjective = project
      ? projectObjectives.find((o) => o.id === data.projectObjectiveId)
      : undefined;
    onSave({
      name: data.name.trim(),
      projectId: project?.id,
      projectName: project?.name,
      projectObjectiveId: projectObjective?.id,
      projectObjectiveName: projectObjective?.name,
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

        {/* Project yes/no, which project, and which of its objectives: one row */}
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr] gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-gray-700">{labels.singular}</span>
            <Controller
              control={form.control}
              name="linkedToProject"
              render={({ field }) => (
                <div className={hasProjects ? undefined : 'pointer-events-none opacity-50'}>
                  <SegmentedToggle
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      if (v === 'no') {
                        form.setValue('projectId', '');
                        form.setValue('projectObjectiveId', '');
                      }
                    }}
                    options={[
                      { label: 'No', value: 'no' },
                      { label: 'Yes', value: 'yes' },
                    ]}
                  />
                </div>
              )}
            />
          </div>

          <Controller
            control={form.control}
            name="projectId"
            rules={{ validate: (v) => linked !== 'yes' || !!v || 'Required' }}
            render={({ field, fieldState }) => (
              <SearchSelect
                label={`${labels.singular} Name`}
                placeholder={
                  hasProjects ? `Select ${labels.singularLower}` : `No ${labels.pluralLower}`
                }
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
                value={field.value}
                onChange={(v) => {
                  field.onChange(v);
                  form.setValue('projectObjectiveId', '');
                }}
                error={fieldState.error?.message}
                disabled={!hasProjects || linked !== 'yes'}
              />
            )}
          />

          <Controller
            control={form.control}
            name="projectObjectiveId"
            render={({ field }) => (
              <SearchSelect
                label="Objective"
                placeholder={
                  projectId && projectObjectives.length === 0
                    ? `No objectives in this ${labels.singularLower}`
                    : 'Select objective (optional)'
                }
                options={projectObjectives.map((o) => ({ value: o.id, label: o.name }))}
                value={field.value}
                onChange={field.onChange}
                disabled={linked !== 'yes' || !projectId || projectObjectives.length === 0}
              />
            )}
          />
        </div>
        {!hasProjects && (
          <p className="text-xs text-gray-400 -mt-2">Not assigned to any {labels.pluralLower}.</p>
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
