'use client';

import { EditableRows } from '@/components/molecules/hr/projects/EditableRows';
import { Group } from '@/components/molecules/hr/projects/Group';
import { TemplatePreview, previewTabs } from '@/components/molecules/hr/projects/TemplatePreview';
import { inputClass } from '@/lib/utils';
import type { ProjectConfig, ProjectTemplateContent } from '@/types/hr';

interface Props {
  name: string;
  config: ProjectConfig;
  content: ProjectTemplateContent;
  onContentChange: (content: ProjectTemplateContent) => void;
}

const hasRepeat = (names: string[]) =>
  new Set(names.map((n) => n.trim().toLowerCase())).size !== names.length;

/** The starter content step: objectives and sprints a project starts with, beside a live preview. */
export function TemplateStarterStep({ name, config, content, onContentChange }: Props) {
  const set = (patch: Partial<ProjectTemplateContent>) => onContentChange({ ...content, ...patch });
  const objectiveNames = content.objectives;
  const sprintNames = content.sprints.map((s) => s.name);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <div className="flex flex-col gap-4 min-w-0">
        <Group title="Objectives">
          <p className="text-sm text-gray-500">The goals work is grouped under.</p>
          <EditableRows
            reorderable
            items={objectiveNames}
            onChange={(objectives) => set({ objectives })}
            addLabel="Add objective"
            onAdd={() =>
              set({ objectives: [...objectiveNames, `Objective ${objectiveNames.length + 1}`] })
            }
            error={hasRepeat(objectiveNames) ? 'Give every objective its own name' : undefined}
            renderItem={(objective, _i, update) => (
              <input
                value={objective}
                onChange={(e) => update(e.target.value)}
                aria-label="Objective name"
                className={inputClass()}
              />
            )}
          />
        </Group>

        <Group title="Sprints">
          <p className="text-sm text-gray-500">In order, with how long each one runs.</p>
          <EditableRows
            reorderable
            items={content.sprints}
            onChange={(sprints) => set({ sprints })}
            addLabel="Add sprint"
            onAdd={() =>
              set({
                sprints: [
                  ...content.sprints,
                  { name: `Sprint ${content.sprints.length + 1}`, days: 14 },
                ],
              })
            }
            error={hasRepeat(sprintNames) ? 'Give every sprint its own name' : undefined}
            renderItem={(sprint, _i, update) => (
              <>
                <input
                  value={sprint.name}
                  onChange={(e) => update({ ...sprint, name: e.target.value })}
                  aria-label="Sprint name"
                  className={inputClass()}
                />
                <input
                  type="number"
                  min={1}
                  value={sprint.days}
                  onChange={(e) =>
                    update({ ...sprint, days: Math.max(1, Number(e.target.value) || 1) })
                  }
                  aria-label="Sprint length in days"
                  className={inputClass(undefined, 'w-20 shrink-0')}
                />
                <span className="shrink-0 text-sm text-gray-500">days</span>
              </>
            )}
          />
        </Group>
      </div>

      <div className="xl:sticky xl:top-0 rounded-2xl bg-brand-tint/50 p-5 min-w-0">
        <TemplatePreview
          name={name}
          config={config}
          tabs={previewTabs(config.features, content.featureLabels)}
          objectives={objectiveNames}
          sprintNames={sprintNames}
          initialFeature={config.features.includes('BACKLOG') ? 'BACKLOG' : 'OBJECTIVES'}
        />
      </div>
    </div>
  );
}
