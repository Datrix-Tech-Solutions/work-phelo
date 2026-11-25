'use client';

import { useMemo, useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { ProjectMembersTable } from '@/components/organisms/hr/projects/ProjectMembersTable';
import { ProjectPeopleFilter } from '@/components/organisms/hr/projects/ProjectPeopleFilter';
import { ProjectContributionCard } from '@/components/organisms/hr/projects/ProjectContributionCard';
import { ProjectOverview } from '@/components/organisms/hr/projects/ProjectOverview';
import {
  BreakdownCard,
  ProgressCard,
  TaskFilter,
  usePriorityLevels,
} from '@/components/organisms/hr/projects/ProjectSummaryCharts';
import { SummaryTasks } from '@/components/organisms/hr/projects/ProjectSummaryTasks';
import { SummaryActivity } from '@/components/organisms/hr/projects/ProjectSummaryActivity';
import { useProjectMembers, useProjectTasks } from '@/hooks';
import { useCanManageProjectTeam } from '@/hooks/hr/useCanManageProjectTeam';
import { useProjectTime, useProjectTimers } from '@/hooks/hr/useProjectTime';
import { useProjectLabels } from '@/hooks/useModuleLabels';
import { formatMoney } from '@/lib/projectPricing';
import { EVERYONE, UNASSIGNED, isOverdue, projectPeople } from '@/lib/projectPeople';
import { taskAssignees } from '@/lib/taskAssignees';
import { formatHoursMinutes } from '@/lib/taskTime';
import { cardClass } from '@/lib/utils';

type SummaryTab = 'tasks' | 'activity';

/**
 * The project at a glance: what it is and its money and hours, then the work, which the people list
 * narrows to one person.
 */
export function ProjectSummary({ projectId }: { projectId: string }) {
  const labels = useProjectLabels();
  const { data: tasks = [], isLoading } = useProjectTasks(projectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const { totalMs, people: time } = useProjectTime(projectId);
  const { timersByTaskId } = useProjectTimers(projectId);
  const levels = usePriorityLevels(projectId);
  const canManage = useCanManageProjectTeam(projectId);
  const [picked, setPicked] = useState(EVERYONE);
  const [teamOpen, setTeamOpen] = useState(false);
  const [tab, setTab] = useState<SummaryTab>('tasks');
  const [filter, setFilter] = useState<TaskFilter | null>(null);

  // Picking something in a card shows the tasks it covers.
  const applyFilter = (next: TaskFilter | null) => {
    setFilter(next);
    if (next) setTab('tasks');
  };

  const people = useMemo(() => projectPeople(members, tasks, time), [members, tasks, time]);
  const unassigned = useMemo(() => tasks.filter((t) => taskAssignees(t).length === 0), [tasks]);

  const person = people.find((p) => p.id === picked);
  // Falls back to everyone when the picked person is no longer in the list.
  const selected = person || picked === UNASSIGNED ? picked : EVERYONE;
  const scoped = person ? person.tasks : selected === UNASSIGNED ? unassigned : tasks;

  // A person's list also has tasks they logged time on and no longer hold, so their hours add up.
  const listed = person
    ? tasks.filter(
        (t) => person.tasks.includes(t) || (t.isTimed && !!timersByTaskId[t.id]?.[person.id]),
      )
    : scoped;

  const value = people.reduce((sum, p) => sum + p.value, 0);
  const unrated = people.filter((p) => p.ms > 0 && !p.member?.hourlyRate).map((p) => p.name);
  const done = scoped.filter((t) => t.status === 'DONE').length;

  if (isLoading) {
    return <div className="h-48 rounded-card bg-gray-100 animate-pulse" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <ProjectOverview projectId={projectId} totalMs={totalMs} value={value} unrated={unrated} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] items-start">
        <ProjectPeopleFilter
          people={people}
          taskCount={tasks.length}
          unassigned={unassigned}
          levels={levels}
          selected={selected}
          onSelect={(id) => {
            setPicked(id);
            setFilter(null);
          }}
          teamLabel={canManage ? 'Manage' : 'View'}
          onOpenTeam={() => setTeamOpen(true)}
        />

        <div className="flex min-w-0 flex-col gap-4">
          <ProjectContributionCard
            projectId={projectId}
            person={person}
            canManage={canManage}
            figures={[
              { label: 'Open', value: String(scoped.length - done) },
              { label: 'Done', value: String(done) },
              { label: 'Overdue', value: String(scoped.filter((t) => isOverdue(t)).length) },
              // Time belongs to a person, so there is none for the unassigned tasks.
              ...(selected === UNASSIGNED
                ? []
                : [
                    { label: 'Hours logged', value: formatHoursMinutes(person?.ms ?? totalMs) },
                    { label: 'Value of time', value: formatMoney(person?.value ?? value) },
                  ]),
            ]}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <BreakdownCard
              projectId={projectId}
              tasks={scoped}
              activeId={filter?.id}
              onFilter={applyFilter}
            />
            <ProgressCard
              projectId={projectId}
              tasks={scoped}
              showEmpty={selected === EVERYONE}
              activeId={filter?.id}
              onFilter={applyFilter}
            />
          </div>

          <TabBar
            tabs={[
              { key: 'tasks', label: 'Tasks' },
              { key: 'activity', label: 'Activity' },
            ]}
            activeTab={tab}
            onTabChange={(key) => setTab(key as SummaryTab)}
          />

          {tab === 'tasks' ? (
            <SummaryTasks
              // Back to the first page when the filters change.
              key={`tasks-${selected}-${filter?.id ?? ''}`}
              projectId={projectId}
              tasks={filter ? scoped.filter(filter.match) : listed}
              filterLabel={filter?.label}
              onClearFilter={() => setFilter(null)}
            />
          ) : (
            <div className={cardClass('p-5')}>
              <SummaryActivity
                projectId={projectId}
                personId={person?.id ?? ''}
                taskIds={new Set(scoped.map((t) => t.id))}
              />
            </div>
          )}
        </div>
      </div>

      <SidePanel
        isOpen={teamOpen}
        onClose={() => setTeamOpen(false)}
        title={`${labels.singular} Team`}
        description={
          canManage
            ? 'Assign and remove people, and set what each person’s hour is worth.'
            : 'Everyone on the team.'
        }
      >
        <ProjectMembersTable projectId={projectId} />
      </SidePanel>
    </div>
  );
}
