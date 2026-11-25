import { formatHoursMinutes } from '@/lib/taskTime';
import type { ProjectInvoice } from '@/types/hr';
import type { ProjectPricing } from '@/types/hr';
import { retainerMonths } from '@/lib/projectPricing';

/** Something that can go on an invoice. */
export interface BillingLine {
  key: string;
  label: string;
  detail: string;
  /** What is still to bill on it. */
  amount: number;
  /** For a task's time: the unbilled minutes that have a rate. */
  minutes?: number;
  /** For a task's time: whose minutes those are. */
  people?: { employeeId: string; minutes: number }[];
  /** Nothing left to bill. */
  billed: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What each key has been invoiced for so far: minutes for a task, or just that it was invoiced. */
function invoicedByKey(invoices: ProjectInvoice[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const inv of invoices) {
    for (const line of inv.lines) map.set(line.key, (map.get(line.key) ?? 0) + (line.minutes ?? 1));
  }
  return map;
}

/** One person's logged time on a task, and what it is billed at. */
export interface TaskPersonTime {
  employeeId: string;
  name: string;
  ms: number;
  rate: number;
}

/**
 * The minutes of each person on a task still to bill. Invoices say whose minutes they billed; older
 * ones only give the task's total, which is taken off the people in turn.
 */
function unbilledByPerson(taskId: string, people: TaskPersonTime[], invoices: ProjectInvoice[]) {
  const billed = new Map<string, number>();
  let unattributed = 0;
  for (const line of invoices.flatMap((i) => i.lines)) {
    if (line.key !== taskId) continue;
    if (!line.people?.length) unattributed += line.minutes ?? 0;
    for (const p of line.people ?? []) {
      billed.set(p.employeeId, (billed.get(p.employeeId) ?? 0) + p.minutes);
    }
  }
  return [...people]
    .sort((a, b) => a.employeeId.localeCompare(b.employeeId))
    .map((p) => {
      const open = Math.max(0, Math.floor(p.ms / 60000) - (billed.get(p.employeeId) ?? 0));
      const taken = Math.min(open, unattributed);
      unattributed -= taken;
      return { ...p, minutes: open - taken };
    });
}

interface Input {
  pricing: ProjectPricing;
  startDate?: string;
  endDate?: string;
  /** The project's timed tasks and each person's time on them. */
  tasks: { id: string; name: string; people: TaskPersonTime[] }[];
  invoices: ProjectInvoice[];
}

/** The lines a project can bill for, by how it is billed. */
export function billingLines({
  pricing,
  startDate,
  endDate,
  tasks,
  invoices,
}: Input): BillingLine[] {
  const invoiced = invoicedByKey(invoices);

  switch (pricing.type) {
    case 'TIMED':
      // Each person's time is priced at their own rate; the full price is all of it together.
      return tasks.flatMap((t) => {
        const logged = t.people.reduce((sum, p) => sum + Math.floor(p.ms / 60000), 0);
        if (logged === 0) return [];
        const open = unbilledByPerson(t.id, t.people, invoices).filter((p) => p.minutes > 0);
        const unbilled = open.reduce((sum, p) => sum + p.minutes, 0);
        // Time with no rate stays unbilled until one is set.
        const priced = open.filter((p) => p.rate > 0);
        const unrated = open.filter((p) => p.rate <= 0);
        const detail = [
          `${formatHoursMinutes(logged * 60000)} logged`,
          unbilled > 0 && unbilled < logged
            ? `${formatHoursMinutes(unbilled * 60000)} unbilled`
            : '',
          unrated.length > 0 ? `no rate for ${unrated.map((p) => p.name).join(', ')}` : '',
        ];
        return [
          {
            key: t.id,
            label: t.name,
            detail: detail.filter(Boolean).join(' · '),
            amount: round2(priced.reduce((sum, p) => sum + round2((p.minutes / 60) * p.rate), 0)),
            minutes: priced.reduce((sum, p) => sum + p.minutes, 0),
            people: priced.map((p) => ({ employeeId: p.employeeId, minutes: p.minutes })),
            billed: unbilled === 0,
          },
        ];
      });
    case 'FLAT_RATE':
      return [
        {
          key: 'price',
          label: 'Project price',
          detail: 'Fixed price',
          amount: pricing.price,
          billed: invoiced.has('price'),
        },
      ];
    case 'MILESTONE':
      return pricing.milestones.map((m) => ({
        key: m.id,
        label: m.name,
        detail: m.dueDate
          ? `Due ${new Date(m.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
          : 'Milestone',
        amount: m.amount,
        billed: invoiced.has(m.id),
      }));
    case 'RETAINER': {
      const months = retainerMonths(startDate, endDate) ?? 0;
      return Array.from({ length: months }, (_, i) => {
        const d = new Date(startDate ?? Date.now());
        d.setMonth(d.getMonth() + i);
        const key = `month-${i + 1}`;
        return {
          key,
          label: `Month ${i + 1}`,
          detail: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
          amount: pricing.monthlyAmount,
          billed: invoiced.has(key),
        };
      });
    }
  }
}
