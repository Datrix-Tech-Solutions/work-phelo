'use client';

import { useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { DataCardGrid } from '@/components/organisms/shared/DataCardGrid';
import { DataCard, DataCardAction } from '@/components/organisms/shared/DataCard';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { projectProgress } from '@/lib/projectProgress';
import { ObjectiveTreePanel } from '@/components/organisms/hr/projects/ObjectiveTreePanel';
import { ObjectiveModal } from '@/components/organisms/hr/projects/ObjectiveModal';
import { useProjectTasks, useProject, useProjectSetup, useMyProfile, usePermission } from '@/hooks';
import { Permission } from '@/lib/permissionMap';
import {
  useAddObjective,
  useProjectObjectives,
  useProjectSubtasks,
  useRemoveObjective,
  useSaveWithToast,
  useUpdateObjective,
} from '@/hooks/hr/useProjectWork';
import { objectiveByTaskId as objectiveMap, taskMetaById } from '@/lib/taskMaps';
import { ProjectObjective } from '@/types/hr';

interface Props {
  projectId: string;
}

export function ProjectObjectives({ projectId }: Props) {
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProjectObjective | undefined>();

  const { data: allObjectives = [] } = useProjectObjectives(projectId);
  const { data: subtasks = [] } = useProjectSubtasks(projectId);
  const config = useProjectSetup(projectId)?.config;
  const addObjective = useAddObjective(projectId);
  const updateObjective = useUpdateObjective(projectId);
  const removeObjective = useRemoveObjective(projectId);
  const save = useSaveWithToast();

  const canManageProjects = usePermission(Permission.CREATE_PROJECT_TASK);
  const { data: myProfile } = useMyProfile();
  const { data: project } = useProject(projectId);
  const canModify =
    canManageProjects || !!(project?.managerId && project.managerId === myProfile?.id);

  const { data: tasks = [], isLoading } = useProjectTasks(projectId);
  const objectiveByTaskId = useMemo(() => objectiveMap(tasks), [tasks]);
  const taskMeta = useMemo(() => taskMetaById(tasks), [tasks]);

  const objectives = useMemo(() => {
    const q = search.toLowerCase();
    return allObjectives.filter((o) => o.name.toLowerCase().includes(q));
  }, [allObjectives, search]);

  const progress = useMemo(
    () => projectProgress({ tasks, objectives: allObjectives, objectiveByTaskId }),
    [tasks, allObjectives, objectiveByTaskId],
  );

  const openPanel = (objective?: ProjectObjective) => {
    setEditing(objective);
    setPanelOpen(true);
  };

  return (
    <>
      <DataCardGrid
        data={objectives}
        isLoading={isLoading}
        searchPlaceholder="Search objectives…"
        searchValue={search}
        onSearch={setSearch}
        actionButton={
          canModify ? { label: 'New Objective', onClick: () => openPanel() } : undefined
        }
        emptyMessage="No objectives found"
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        renderCard={(objective) => {
          const { total, done, percent } = progress.perObjective.get(objective.id) ?? {
            total: 0,
            done: 0,
            percent: 0,
          };
          const actions: DataCardAction[] = canModify
            ? [
                {
                  label: 'Edit',
                  onClick: () => openPanel(objective),
                  className: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
                },
                {
                  label: 'Delete',
                  onClick: () => save(removeObjective.mutateAsync(objective.id)),
                  className: 'bg-red-50 text-red-600 hover:bg-red-100',
                },
              ]
            : [];
          return (
            <DataCard
              onClick={() => setViewingId(objective.id)}
              icon={
                <div className="w-10 h-10 rounded-lg bg-brand-tint flex items-center justify-center shrink-0">
                  <Target className="w-5 h-5 text-brand" />
                </div>
              }
              title={objective.name}
              subtitle={`${done} of ${total} ${total === 1 ? 'task' : 'tasks'} done`}
              note={
                <div className="flex flex-col gap-3">
                  {objective.description && (
                    <p className="text-sm text-gray-600">{objective.description}</p>
                  )}
                  <ProgressBar value={percent} />
                </div>
              }
              actions={actions}
            />
          );
        }}
      />

      <ObjectiveTreePanel
        objective={allObjectives.find((o) => o.id === viewingId) ?? null}
        onClose={() => setViewingId(null)}
        tasks={tasks}
        subtasks={subtasks}
        objectiveByTaskId={objectiveByTaskId}
        taskMeta={taskMeta}
        workTypes={config?.workTypes ?? []}
        progress={
          (viewingId && progress.perObjective.get(viewingId)) || { done: 0, total: 0, percent: 0 }
        }
      />

      <ObjectiveModal
        key={editing?.id ?? 'new'}
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSubmit={(dto) =>
          save(
            editing
              ? updateObjective.mutateAsync({ id: editing.id, dto })
              : addObjective.mutateAsync(dto),
          )
        }
        objective={editing}
      />
    </>
  );
}
