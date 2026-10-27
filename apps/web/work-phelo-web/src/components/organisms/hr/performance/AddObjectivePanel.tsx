'use client';

import { useEffect, useMemo } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Icons } from '@/components/atoms/icons';
import { FormField } from '@/components/molecules/shared/FormField';
import { useGoals } from '@/hooks/hr/useGoalAppraisals';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ProjectObjective } from '@/types/hr';

export interface ObjectiveInput {
  /** Empty when the objective is left without a goal, to be linked later. */
  goalId: string;
  /** Picked from the person's project objectives or typed fresh; only the name is kept, with no link back. */
  name: string;
  comments: string[];
}

interface FormValues {
  goalId: string;
  name: string;
  comments: { value: string }[];
}

const EMPTY: FormValues = {
  goalId: '',
  name: '',
  comments: [{ value: '' }],
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Projects the person is assigned to; their objectives' names are offered as suggestions. */
  projects: { id: string; name: string }[];
  onSave: (objective: ObjectiveInput) => void;
}

export function AddObjectivePanel({ isOpen, onClose, projects, onSave }: Props) {
  const form = useForm<FormValues>({ defaultValues: EMPTY });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'comments' });

  const { goals } = useGoals();
  const name = useWatch({ control: form.control, name: 'name' });

  // The objectives of each of the person's projects.
  const projectObjectives = useQueries({
    queries: projects.map((p) => ({
      queryKey: ['projects', p.id, 'objectives'],
      queryFn: async () =>
        (await api.get<ProjectObjective[]>(`/hr/projects/${p.id}/objectives`)).data,
    })),
  });
  const allProjectObjectives = useMemo(
    () => projectObjectives.flatMap((q) => q.data ?? []),
    [projectObjectives],
  );
  const objectiveOptions = useMemo(() => {
    const names = new Set([
      ...allProjectObjectives.map((o) => o.name),
      // A name created because no objective matched stays selectable until another is picked.
      ...(name ? [name] : []),
    ]);
    return [...names].map((name) => ({ value: name, label: name }));
  }, [allProjectObjectives, name]);

  useEffect(() => {
    if (isOpen) form.reset(EMPTY);
  }, [isOpen, form]);

  const submit = form.handleSubmit((data) => {
    onSave({
      goalId: data.goalId,
      name: data.name.trim(),
      comments: data.comments.map((c) => c.value.trim()).filter(Boolean),
    });
    onClose();
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Objective"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Save Objective</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 mt-4">
        <Controller
          control={form.control}
          name="goalId"
          render={({ field, fieldState }) => (
            <SearchSelect
              label="Goal (optional)"
              placeholder={goals.length === 0 ? 'No goals yet' : 'Select goal'}
              options={goals.map((g) => ({ value: g.id, label: g.name }))}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              disabled={goals.length === 0}
            />
          )}
        />

        <Controller
          control={form.control}
          name="name"
          rules={{ validate: (v) => !!v.trim() || 'Required' }}
          render={({ field, fieldState }) => (
            <SearchSelect
              label="Objective"
              placeholder="Select objective"
              options={objectiveOptions}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              emptyState={({ query, close }) => (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    field.onChange(query.trim());
                    close();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left text-brand hover:bg-gray-300 transition-colors"
                >
                  <Icons.Plus className="w-4 h-4 shrink-0" />
                  <span>
                    No objective found — <span className="font-semibold">Create objective</span>
                  </span>
                </button>
              )}
            />
          )}
        />

        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Comments</p>
          {fields.map((item, index) => (
            <div key={item.id} className="flex items-end gap-2">
              <div className="flex-1">
                <FormField
                  label={`Comment ${index + 1}`}
                  registration={form.register(`comments.${index}.value`)}
                  placeholder="eg; Waiting on feedback from the client"
                />
              </div>
              {fields.length > 1 && (
                <Button variant="outline" onClick={() => remove(index)} aria-label="Remove comment">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          <div>
            <Button variant="outline" onClick={() => append({ value: '' })}>
              <Plus className="w-4 h-4" /> Add comment
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
