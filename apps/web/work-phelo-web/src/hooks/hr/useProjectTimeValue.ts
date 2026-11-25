import { useProjectMembers } from '@/hooks';
import { useProjectTime } from '@/hooks/hr/useProjectTime';
import { accruedAmount } from '@/lib/taskTime';

/** The time logged on a project and what it is worth at each person's rate. */
export function useProjectTimeValue(projectId: string) {
  const { totalMs, people } = useProjectTime(projectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const rows = people.map((p) => {
    const rate = members.find((m) => m.employeeId === p.personId)?.hourlyRate ?? 0;
    return { ...p, rate, value: accruedAmount(p.ms, rate) };
  });
  return {
    totalMs,
    rows,
    value: rows.reduce((sum, r) => sum + r.value, 0),
    /** The names of people with logged time and no rate. */
    unrated: rows.filter((r) => r.ms > 0 && r.rate <= 0).map((r) => r.personName),
  };
}
