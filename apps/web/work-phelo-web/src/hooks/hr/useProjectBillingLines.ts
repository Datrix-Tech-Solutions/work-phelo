import { useMemo } from 'react';
import { useProject, useProjectMembers, useProjectSetup, useProjectTasks } from '@/hooks';
import { useProjectInvoices } from '@/hooks/hr/useProjectInvoices';
import { useProjectTimers } from '@/hooks/hr/useProjectTime';
import { billingLines } from '@/lib/projectBilling';
import { pricingExpectedValue } from '@/lib/projectPricing';
import { timerElapsedMs, useNow } from '@/lib/taskTime';

/** What a billable project can bill for, and what has been and is still to be billed. */
export function useProjectBillingLines(projectId: string) {
  const { data: project } = useProject(projectId);
  const { data: tasks } = useProjectTasks(projectId);
  const { data: members } = useProjectMembers(projectId);
  const pricing = useProjectSetup(projectId)?.pricing;
  const { timersByTaskId, timedByTaskId, anyRunning } = useProjectTimers(projectId);
  const { invoices, active, statusOf } = useProjectInvoices(projectId);
  const now = useNow(anyRunning);
  // The dates a retainer or milestone project is priced over.
  const startDate = project?.startDate?.slice(0, 10);
  const endDate = project?.endDate?.slice(0, 10);

  const lines = useMemo(() => {
    if (!pricing) return [];
    const rates = new Map((members ?? []).map((m) => [m.employeeId, m.hourlyRate ?? 0]));
    return billingLines({
      pricing,
      startDate,
      endDate,
      tasks: (tasks ?? [])
        .filter((t) => timedByTaskId[t.id])
        .map((t) => ({
          id: t.id,
          name: t.name,
          people: Object.values(timersByTaskId[t.id] ?? {}).map((timer) => ({
            employeeId: timer.personId,
            name: timer.personName,
            ms: timerElapsedMs(timer, now),
            rate: rates.get(timer.personId) ?? 0,
          })),
        })),
      invoices: active,
    });
  }, [pricing, startDate, endDate, tasks, timedByTaskId, timersByTaskId, members, now, active]);

  const invoiced = active.reduce((sum, i) => sum + i.amount, 0);
  const left = lines.filter((l) => !l.billed).reduce((sum, l) => sum + l.amount, 0);
  /** The project's whole price; for a timed project, what has accrued so far. */
  const full = !pricing
    ? 0
    : pricing.type === 'TIMED'
      ? invoiced + left
      : (pricingExpectedValue(pricing, startDate, endDate) ?? 0);

  return { lines, invoices, active, statusOf, invoiced, left, full };
}
