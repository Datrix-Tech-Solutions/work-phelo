'use client';

import { RotateCcw } from 'lucide-react';
import { Group } from '@/components/molecules/hr/projects/Group';
import { EditableRows } from '@/components/molecules/hr/projects/EditableRows';
import { TemplatePreview, previewTabs } from '@/components/molecules/hr/projects/TemplatePreview';
import { getProjectConfigErrors } from '@/components/molecules/hr/projects/ProjectConfigFields';
import { WorkTypeIconPicker } from '@/components/atoms/WorkTypeIconPicker';
import { PriorityColorPicker } from '@/components/atoms/PriorityColorPicker';
import { PROJECT_FEATURE_LABELS } from '@/lib/projectFeatures';
import { inputClass } from '@/lib/utils';
import type { ProjectConfig, ProjectFeature, ProjectTemplateContent } from '@/types/hr';

const FEATURES = Object.keys(PROJECT_FEATURE_LABELS) as ProjectFeature[];

interface Props {
  name: string;
  config: ProjectConfig;
  onConfigChange: (config: ProjectConfig) => void;
  content: ProjectTemplateContent;
  onContentChange: (content: ProjectTemplateContent) => void;
  /** Show the validation messages (after a failed Next). */
  showErrors?: boolean;
}

/** The setup step: the settings on one side and a live preview of a project on the other. */
export function TemplateSetupStep({
  name,
  config,
  onConfigChange,
  content,
  onContentChange,
  showErrors,
}: Props) {
  const errors = showErrors ? getProjectConfigErrors(config) : {};
  const set = (patch: Partial<ProjectConfig>) => onConfigChange({ ...config, ...patch });

  const labelOf = (f: ProjectFeature) => content.featureLabels[f] ?? PROJECT_FEATURE_LABELS[f];
  const setLabel = (f: ProjectFeature, label: string) =>
    onContentChange({ ...content, featureLabels: { ...content.featureLabels, [f]: label } });
  const resetLabel = (f: ProjectFeature) => {
    onContentChange({
      ...content,
      featureLabels: Object.fromEntries(
        Object.entries(content.featureLabels).filter(([key]) => key !== f),
      ),
    });
  };

  const toggleFeature = (f: ProjectFeature) =>
    set({
      features: config.features.includes(f)
        ? config.features.filter((x) => x !== f)
        : [...config.features, f],
    });

  const tabs = previewTabs(config.features, content.featureLabels);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <div className="flex flex-col gap-4 min-w-0">
        <Group title="Work types" hasError={!!errors.workTypes}>
          <EditableRows
            items={config.workTypes}
            onChange={(workTypes) => set({ workTypes })}
            addLabel="Add work type"
            onAdd={() =>
              set({
                workTypes: [
                  ...config.workTypes,
                  { name: `Work type ${config.workTypes.length + 1}`, icon: 'TASK' },
                ],
              })
            }
            error={errors.workTypes}
            renderItem={(w, _i, update) => (
              <>
                <WorkTypeIconPicker value={w.icon} onChange={(icon) => update({ ...w, icon })} />
                <input
                  value={w.name}
                  onChange={(e) => update({ ...w, name: e.target.value })}
                  aria-label="Work type name"
                  className={inputClass()}
                />
              </>
            )}
          />
        </Group>

        <Group title="Statuses" hasError={!!errors.workflow}>
          <EditableRows
            reorderable
            items={config.workflow}
            onChange={(workflow) => set({ workflow })}
            addLabel="Add status"
            onAdd={() =>
              set({ workflow: [...config.workflow, `Status ${config.workflow.length + 1}`] })
            }
            error={errors.workflow}
            renderItem={(status, _i, update) => (
              <input
                value={status}
                onChange={(e) => update(e.target.value)}
                aria-label="Status name"
                className={inputClass()}
              />
            )}
          />
        </Group>

        <Group title="Views" hasError={!!errors.features}>
          <p className="text-sm text-gray-500">
            Turn the views you want on and rename them. A renamed view works the same way.
          </p>
          <ul className="flex flex-col gap-2">
            {FEATURES.map((f) => {
              const custom = f in content.featureLabels;
              return (
                <li key={f} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.features.includes(f)}
                    onChange={() => toggleFeature(f)}
                    aria-label={`Turn on ${PROJECT_FEATURE_LABELS[f]}`}
                    className="h-4 w-4 shrink-0 accent-(--module-btn-bg,var(--color-brand))"
                  />
                  <input
                    value={labelOf(f)}
                    onChange={(e) => setLabel(f, e.target.value)}
                    onBlur={(e) => !e.target.value.trim() && resetLabel(f)}
                    disabled={!config.features.includes(f)}
                    aria-label={`Name of ${PROJECT_FEATURE_LABELS[f]}`}
                    className={inputClass()}
                  />
                  <button
                    type="button"
                    title={`Back to "${PROJECT_FEATURE_LABELS[f]}"`}
                    aria-label="Reset name"
                    disabled={!custom}
                    onClick={() => resetLabel(f)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-input text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          {errors.features && <p className="text-xs text-red-500">{errors.features}</p>}
        </Group>

        <Group title="Priority levels" hasError={!!errors.priorities}>
          <p className="text-sm text-gray-500">From lowest to highest.</p>
          <EditableRows
            reorderable
            items={config.priorities}
            onChange={(priorities) => set({ priorities })}
            addLabel="Add priority level"
            onAdd={() =>
              set({
                priorities: [
                  ...config.priorities,
                  { name: `Level ${config.priorities.length + 1}`, color: 'GRAY' },
                ],
              })
            }
            error={errors.priorities}
            renderItem={(p, _i, update) => (
              <>
                <PriorityColorPicker
                  value={p.color}
                  onChange={(color) => update({ ...p, color })}
                />
                <input
                  value={p.name}
                  onChange={(e) => update({ ...p, name: e.target.value })}
                  aria-label="Priority level name"
                  className={inputClass()}
                />
              </>
            )}
          />
        </Group>
      </div>

      <div className="xl:sticky xl:top-0 rounded-2xl bg-brand-tint/50 p-5 min-w-0">
        <TemplatePreview
          name={name}
          config={config}
          tabs={tabs}
          objectives={content.objectives}
          sprintNames={content.sprints.map((sp) => sp.name)}
        />
      </div>
    </div>
  );
}
