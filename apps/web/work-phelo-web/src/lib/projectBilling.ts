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
  /** For a task's time: the unbilled minutes. */
  minutes?: number;
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

interface Input {
  pricing: ProjectPricing;
  startDate?: string;
  endDate?: string;
  /** The project's timed tasks and the time logged on each, in ms. */
  tasks: { id: string; name: string; ms: number }[];
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
      // Each task is priced on its own time; the full price is all of them together.
      return tasks.flatMap((t) => {
        const logged = Math.floor(t.ms / 60000);
        if (logged === 0) return [];
        const unbilled = Math.max(0, logged - (invoiced.get(t.id) ?? 0));
        return [
          {
            key: t.id,
            label: t.name,
            detail: `${formatHoursMinutes(logged * 60000)} logged${
              unbilled > 0 && unbilled < logged
                ? ` · ${formatHoursMinutes(unbilled * 60000)} unbilled`
                : ''
            }`,
            amount: round2((unbilled / 60) * pricing.hourlyRate),
            minutes: unbilled,
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
