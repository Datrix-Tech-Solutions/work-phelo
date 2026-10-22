'use client';

import { useMemo, useState } from 'react';
import { Calendar, Target, Timer } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import type { TaskAssignee, TaskStatus, ProjectTask, WorkTypeIcon } from '@/types/hr';
import { AvatarStack } from '@/components/atoms/AvatarStack';
import { TypeChipSelect, TypeChipOption } from '@/components/atoms/TypeChipSelect';
import { objectiveChipOptions } from '@/lib/objectiveChipOptions';
import { TypeChip } from '@/components/atoms/TypeChip';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { currentSprint, sprintState } from '@/lib/projectSprints';
import { taskAssignees } from '@/lib/taskAssignees';
import {
  useProjectTasks,
  useUpdateTaskStatus,
  useProject,
  useMyProfile,
  usePermission,
} from '@/hooks';
import { Permission } from '@/lib/permissionMap';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { glassStrongClass, cn, todayLocal } from '@/lib/utils';
import { useProjectLocalStore } from '@/store/projectLocal.store';
import { useProjectWorkStore } from '@/store/projectWork.store';
import { WorkTypeIconBadge } from '@/lib/workTypeIcons';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { TaskDetailsPanel } from '@/components/organisms/hr/projects/TaskDetailsPanel';

interface BoardColumn {
  key: string;
  label: string;
  color: string;
}

/** Every column has the same fixed width and is only as tall as its cards, up to a limit; past that it scrolls on its own. */
const COLUMN_SIZE = 'w-72 shrink-0 max-h-[calc(100dvh-18rem)]';

const LEGACY_COLUMNS: BoardColumn[] = [
  { key: 'TODO', label: 'TO DO', color: 'bg-gray-400' },
  { key: 'IN_PROGRESS', label: 'IN PROGRESS', color: 'bg-blue-500' },
  { key: 'ON_HOLD', label: 'ON HOLD', color: 'bg-amber-500' },
  { key: 'DONE', label: 'DONE', color: 'bg-green-500' },
];

const STAGE_COLORS = ['bg-gray-400', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-teal-500'];

/** One column per workflow stage; the first is neutral and the last is green (done). */
function workflowColumns(workflow: string[]): BoardColumn[] {
  return workflow.map((stage, i) => ({
    key: stage,
    label: stage.toUpperCase(),
    color: i === workflow.length - 1 ? 'bg-green-500' : STAGE_COLORS[i % STAGE_COLORS.length],
  }));
}

/** Where a task whose stage was never set lands, going by the status the backend holds. */
function stageFromStatus(workflow: string[], status: TaskStatus): string {
  if (status === 'DONE') return workflow[workflow.length - 1];
  if (status === 'TODO') return workflow[0];
  return workflow[workflow.length > 2 ? 1 : 0];
}

/** The backend only knows four statuses, so a stage maps to the nearest one: first is to do, last is done. */
function statusFromStage(workflow: string[], stage: string): TaskStatus {
  const i = workflow.indexOf(stage);
  if (i === workflow.length - 1) return 'DONE';
  return i <= 0 ? 'TODO' : 'IN_PROGRESS';
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** A card on the board. Subtasks aren't cards: they're the steps of a task, shown as its progress. */
interface BoardItem {
  id: string;
  name: string;
  task: ProjectTask;
  /** Its work type and the objective it belongs to, if any. */
  typeName: string;
  typeIcon: WorkTypeIcon;
  objectiveId?: string;
  objectiveName?: string;
  /** Everyone the task is assigned to. */
  assignees: TaskAssignee[];
  /** For a task with subtasks: how many are done. */
  subtaskProgress?: { done: number; total: number };
}

/** Lets a card's objective be changed in place. Left out where the person can't edit. */
interface ObjectiveEdit {
  options: TypeChipOption[];
  onChange: (taskId: string, objectiveId: string) => void;
}

function CardBody({ item, objectiveEdit }: { item: BoardItem; objectiveEdit?: ObjectiveEdit }) {
  const task = item.task;
  return (
    <>
      <div className="flex items-center gap-1.5">
        <WorkTypeIconBadge icon={item.typeIcon} />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 truncate">
          {item.typeName}
        </span>
      </div>
      <p className="text-sm font-semibold text-gray-900 leading-snug">{item.name}</p>
      {objectiveEdit ? (
        <div className="flex min-w-0">
          <TypeChipSelect
            value={item.objectiveId ?? ''}
            options={objectiveEdit.options}
            emptyLabel="No objective"
            onChange={(id) => objectiveEdit.onChange(item.id, id)}
          />
        </div>
      ) : (
        item.objectiveName && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Target className="w-3.5 h-3.5 shrink-0 text-gray-400" />
            <span className="text-xs text-gray-500 truncate">{item.objectiveName}</span>
          </div>
        )
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center min-w-0">
          {item.assignees.length > 0 ? (
            <AvatarStack people={item.assignees} size={24} />
          ) : (
            <span className="text-xs text-gray-400">Unassigned</span>
          )}
        </div>
        {task.dueDate && (
          <div className="flex items-center gap-1 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">{formatDate(task.dueDate)}</span>
          </div>
        )}
      </div>
      {item.subtaskProgress && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-500">
            {item.subtaskProgress.done} of {item.subtaskProgress.total}{' '}
            {item.subtaskProgress.total === 1 ? 'subtask' : 'subtasks'} done
          </p>
          <ProgressBar
            value={Math.round((item.subtaskProgress.done / item.subtaskProgress.total) * 100)}
            showLabel={false}
          />
        </div>
      )}
    </>
  );
}

function BoardCard({
  item,
  canMove,
  isDragging = false,
  onOpen,
  objectiveEdit,
}: {
  item: BoardItem;
  canMove: boolean;
  isDragging?: boolean;
  onOpen: (item: BoardItem) => void;
  objectiveEdit?: ObjectiveEdit;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: item.id,
    disabled: !canMove,
    data: { item },
  });

  // No transform here: the DragOverlay is what follows the pointer, and moving this card too
  // would drag a faded copy along beside it.
  return (
    <div
      ref={setNodeRef}
      onClick={() => onOpen(item)}
      {...(canMove ? listeners : {})}
      {...(canMove ? attributes : {})}
      className={glassStrongClass(
        cn(
          'rounded-xl shadow-lg p-2.5 flex flex-col gap-1.5 transition-opacity touch-none',
          canMove && 'cursor-grab active:cursor-grabbing',
          isDragging ? 'opacity-40' : 'opacity-100',
        ),
        'plain',
      )}
    >
      <CardBody item={item} objectiveEdit={objectiveEdit} />
    </div>
  );
}

function BoardCardOverlay({ item }: { item: BoardItem }) {
  return (
    <div
      className={glassStrongClass(
        'rounded-xl p-2.5 flex flex-col gap-1.5 shadow-xl rotate-2 opacity-95 border-brand/40',
        'plain',
      )}
    >
      <CardBody item={item} />
    </div>
  );
}

function KanbanColumn({
  col,
  items,
  canMove,
  activeId,
  onOpen,
  objectiveEdit,
}: {
  col: BoardColumn;
  items: BoardItem[];
  canMove: boolean;
  activeId: string | null;
  onOpen: (item: BoardItem) => void;
  objectiveEdit?: ObjectiveEdit;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-3 ${COLUMN_SIZE} rounded-xl px-3 pb-3 pt-0 transition-colors ${
        isOver ? 'bg-brand/5 ring-2 ring-brand/20' : ''
      }`}
    >
      {/* The header stays put: only the cards below it scroll. */}
      <div
        className={glassStrongClass(
          'rounded-xl shadow-lg px-3 py-2.5 flex items-center gap-2 shrink-0',
          'plain',
        )}
      >
        <span className={`w-2 h-2 rounded-full ${col.color}`} />
        <span className="text-xs font-bold tracking-wide text-gray-600">{col.label}</span>
        <span className="ml-auto text-xs font-medium text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
          {items.length}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 min-h-0 overflow-y-auto">
        {items.length === 0 ? (
          // An empty column is just the header and a slim dashed slot, which lights up as a drop target.
          <div
            className={`h-12 rounded-lg border-2 border-dashed transition-colors ${
              isOver ? 'border-brand/40 bg-brand/5' : 'border-gray-200'
            }`}
          />
        ) : (
          items.map((item) => (
            <BoardCard
              key={item.id}
              item={item}
              canMove={canMove}
              isDragging={activeId === item.id}
              onOpen={onOpen}
              objectiveEdit={objectiveEdit}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface Props {
  projectId: string;
}

export function ProjectBoard({ projectId }: Props) {
  const toast = useToastStore((s) => s.addToast);

  const canManageProjects = usePermission(Permission.UPDATE_PROJECT_TASK);
  const { data: myProfile } = useMyProfile();
  const { data: project } = useProject(projectId);
  const isProjectManager = !!(
    project?.managerId &&
    myProfile?.id &&
    project.managerId === myProfile.id
  );

  const { data: tasks = [], isLoading } = useProjectTasks(projectId);
  const updateStatus = useUpdateTaskStatus();

  const workflow = useProjectLocalStore((s) => s.byProjectId[projectId]?.config.workflow);
  const stageByTaskId = useProjectLocalStore((s) => s.stageByTaskId);
  const setTaskStage = useProjectLocalStore((s) => s.setTaskStage);

  // A project with a saved workflow gets a column per stage; older ones keep the four statuses.
  const columns = useMemo(
    () => (workflow ? workflowColumns(workflow) : LEGACY_COLUMNS),
    [workflow],
  );

  const allSubtasks = useProjectWorkStore((s) => s.subtasks);
  const allObjectives = useProjectWorkStore((s) => s.objectives);
  const objectiveByTaskId = useProjectWorkStore((s) => s.objectiveByTaskId);
  const taskMeta = useProjectWorkStore((s) => s.taskMeta);
  const assigneesByTaskId = useProjectWorkStore((s) => s.assigneesByTaskId);
  const workTypes = useProjectLocalStore((s) => s.byProjectId[projectId]?.config.workTypes);

  const config = useProjectLocalStore((s) => s.byProjectId[projectId]?.config);

  // With sprints, the board is just the current sprint's tasks, nothing else.
  const allSprints = useProjectWorkStore((s) => s.sprints);
  const today = todayLocal();
  const projectSprints = useMemo(
    () =>
      allSprints
        .filter((sp) => sp.projectId === projectId)
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [allSprints, projectId],
  );
  // Which sprint the board follows: the one picked in the dropdown, else the current one.
  const [pickedSprintId, setPickedSprintId] = useState('');
  const sprint = useMemo(
    () =>
      projectSprints.find((sp) => sp.id === pickedSprintId) ?? currentSprint(projectSprints, today),
    [projectSprints, pickedSprintId, today],
  );
  const boardTasks = useMemo(
    () => (sprint ? tasks.filter((t) => sprint.taskIds.includes(t.id)) : tasks),
    [sprint, tasks],
  );

  const items = useMemo<BoardItem[]>(
    () =>
      boardTasks.map((t) => {
        const own = allSubtasks.filter((st) => st.taskId === t.id);
        const typeName = taskMeta[t.id]?.workType || 'Task';
        return {
          id: t.id,
          name: t.name,
          task: t,
          typeName,
          typeIcon: workTypes?.find((w) => w.name === typeName)?.icon ?? 'TASK',
          objectiveId: objectiveByTaskId[t.id],
          objectiveName: allObjectives.find((o) => o.id === objectiveByTaskId[t.id])?.name,
          assignees: taskAssignees(t, assigneesByTaskId),
          subtaskProgress: own.length
            ? { done: own.filter((st) => st.done).length, total: own.length }
            : undefined,
        };
      }),
    [
      boardTasks,
      allSubtasks,
      allObjectives,
      objectiveByTaskId,
      taskMeta,
      assigneesByTaskId,
      workTypes,
    ],
  );

  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const openTask = tasks.find((t) => t.id === openTaskId);
  const [activeItem, setActiveItem] = useState<BoardItem | null>(null);
  // optimistic overrides: item id → column key
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const canMoveItem = (item: BoardItem) =>
    canManageProjects || isProjectManager || item.assignees.some((a) => a.id === myProfile?.id);

  const setTaskObjective = useProjectWorkStore((s) => s.setTaskObjective);
  const projectObjectives = useMemo(
    () => allObjectives.filter((o) => o.projectId === projectId),
    [allObjectives, projectId],
  );
  const canEditTasks = canManageProjects || isProjectManager;
  // Only offered to people who can edit, and when the project has objectives to pick from.
  const objectiveEdit: ObjectiveEdit | undefined =
    canEditTasks && projectObjectives.length > 0
      ? {
          options: objectiveChipOptions(projectObjectives),
          onChange: (taskId, id) => setTaskObjective(taskId, id || null),
        }
      : undefined;

  const savedStageOf = (item: BoardItem): string => {
    if (!workflow) return item.task.status;
    const saved = stageByTaskId[item.id];
    return saved && workflow.includes(saved) ? saved : stageFromStatus(workflow, item.task.status);
  };
  const stageOf = (item: BoardItem) => optimistic[item.id] ?? savedStageOf(item);

  const grouped = useMemo(() => {
    const map: Record<string, BoardItem[]> = Object.fromEntries(columns.map((c) => [c.key, []]));
    for (const item of items) {
      map[optimistic[item.id] ?? savedStageOf(item)]?.push(item);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, optimistic, columns, workflow, stageByTaskId]);

  const handleDragStart = (event: DragStartEvent) => {
    const item = items.find((i) => i.id === event.active.id);
    if (item) setActiveItem(item);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over, active } = event;
    if (!over || !active) return;
    const newStage = String(over.id);
    const item = items.find((i) => i.id === active.id);
    if (!item) return;
    if (newStage !== stageOf(item) && columns.some((c) => c.key === newStage)) {
      setOptimistic((prev) => ({ ...prev, [item.id]: newStage }));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { over, active } = event;
    setActiveItem(null);

    const clearOptimistic = (id: string) =>
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

    if (!over) {
      clearOptimistic(String(active.id));
      return;
    }

    const newStage = String(over.id);
    const item = items.find((i) => i.id === active.id);
    if (!item || !columns.some((c) => c.key === newStage)) return;

    if (newStage === savedStageOf(item)) {
      clearOptimistic(item.id);
      return;
    }

    try {
      const task = item.task;
      const status = workflow ? statusFromStage(workflow, newStage) : (newStage as TaskStatus);
      if (status !== task.status) await updateStatus.mutateAsync({ taskId: task.id, status });
      if (workflow) setTaskStage(task.id, newStage);
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    } finally {
      clearOptimistic(item.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div
            key={col.key}
            className={`flex flex-col gap-3 ${COLUMN_SIZE} rounded-xl px-3 pb-3 pt-0`}
          >
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {sprint && (
        <div className="flex items-center gap-2 text-sm">
          <Timer className="w-4 h-4 text-gray-400" />
          <span className="font-semibold text-gray-900">{sprint.name}</span>
          <span className="text-gray-400">
            {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
          </span>
          <TypeChip
            label={sprintState(sprint, today).label}
            color={sprintState(sprint, today).color}
          />
          <div className="ml-2 w-48">
            <SearchSelect
              size="sm"
              placeholder="Sprint"
              options={projectSprints.map((sp) => ({
                value: sp.id,
                label: sp.name,
                sublabel: sprintState(sp, today).label,
              }))}
              value={sprint.id}
              clearable={false}
              onChange={setPickedSprintId}
            />
          </div>
        </div>
      )}

      <div className="flex items-start gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <KanbanColumn
            key={col.key}
            col={col}
            items={grouped[col.key]}
            canMove={grouped[col.key].some(canMoveItem)}
            activeId={activeItem?.id ?? null}
            onOpen={(item) => setOpenTaskId(item.id)}
            objectiveEdit={objectiveEdit}
          />
        ))}
      </div>

      <TaskDetailsPanel
        task={tasks.find((t) => t.id === openTaskId) ?? null}
        onClose={() => setOpenTaskId(null)}
        projectId={projectId}
        canManageSubtasks={canManageProjects || isProjectManager}
        workType={openTaskId ? taskMeta[openTaskId]?.workType : undefined}
        priority={openTaskId ? taskMeta[openTaskId]?.priority : undefined}
        priorities={config?.priorities}
        assignees={openTask ? taskAssignees(openTask, assigneesByTaskId) : []}
        objectiveId={openTaskId ? objectiveByTaskId[openTaskId] : undefined}
        objectiveOptions={objectiveChipOptions(projectObjectives)}
        onObjectiveChange={
          canEditTasks && openTaskId ? (id) => setTaskObjective(openTaskId, id || null) : undefined
        }
        objectiveName={
          openTaskId
            ? allObjectives.find((o) => o.id === objectiveByTaskId[openTaskId])?.name
            : undefined
        }
      />

      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
        {activeItem ? <BoardCardOverlay item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
