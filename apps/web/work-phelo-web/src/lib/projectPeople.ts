import { taskAssignees } from '@/lib/taskAssignees';
import { accruedAmount } from '@/lib/taskTime';
import type { PersonProjectTime } from '@/lib/taskTime';
import type { ProjectMember, ProjectTask } from '@/types/hr';

/** The filter's value for the whole project, and for the tasks nobody holds. */
export const EVERYONE = '';
export const UNASSIGNED = 'unassigned';

/** Someone on a project: a member, or a person with tasks or logged time who isn't one. */
export interface ProjectPerson {
  id: string;
  name: string;
  avatarUrl?: string;
  member?: ProjectMember;
  tasks: ProjectTask[];
  open: number;
  done: number;
  /** Time logged on timed tasks. */
  ms: number;
  /** That time at their rate. */
  value: number;
}

export function projectPeople(
  members: ProjectMember[],
  tasks: ProjectTask[],
  time: PersonProjectTime[],
): ProjectPerson[] {
  const known = new Map<string, { name: string; avatarUrl?: string; member?: ProjectMember }>();
  for (const m of members) {
    known.set(m.employeeId, { name: m.name, avatarUrl: m.avatarUrl, member: m });
  }
  for (const a of tasks.flatMap(taskAssignees)) {
    if (!known.has(a.id)) known.set(a.id, { name: a.name, avatarUrl: a.avatarUrl });
  }
  for (const t of time) {
    if (!known.has(t.personId)) known.set(t.personId, { name: t.personName });
  }

  return [...known]
    .map(([id, person]) => {
      const own = tasks.filter((t) => taskAssignees(t).some((a) => a.id === id));
      const done = own.filter((t) => t.status === 'DONE').length;
      const ms = time.find((t) => t.personId === id)?.ms ?? 0;
      return {
        ...person,
        id,
        tasks: own,
        open: own.length - done,
        done,
        ms,
        value: accruedAmount(ms, person.member?.hourlyRate ?? 0),
      };
    })
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
}

/** Not done, and due before today. */
export function isOverdue(task: ProjectTask, today = new Date()): boolean {
  if (task.status === 'DONE' || !task.dueDate) return false;
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const [y, m, d] = task.dueDate.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).getTime() < day;
}
