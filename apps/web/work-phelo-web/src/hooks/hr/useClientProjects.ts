import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { pricingExpectedValue } from '@/lib/projectPricing';
import { accruedAmount } from '@/lib/taskTime';
import type { Project, ProjectPricing } from '@/types/hr';

export interface ClientProject {
  id: string;
  name: string;
  billable: boolean;
  pricing?: ProjectPricing;
  /** What the client is expected to pay, from the project's pricing; null when there isn't one. */
  expectedValue: number | null;
  /** For a timed project: what the time logged so far is worth. */
  accrued: number | null;
  createdAt: string;
}

/** The projects started for a marketing client, among those the person can see, with the time logged on them. */
export function useClientProjects(clientId: string): ClientProject[] {
  const { data = [] } = useQuery({
    queryKey: ['projects', 'by-client', clientId],
    queryFn: async () => {
      const res = await api.get<(Project & { loggedSeconds: number })[]>(
        `/hr/projects/by-client/${clientId}`,
      );
      return res.data;
    },
    enabled: !!clientId,
  });
  return useMemo(
    () =>
      data.map((p) => ({
        id: p.id,
        name: p.name,
        billable: !!p.billable,
        pricing: p.pricing,
        expectedValue: p.pricing
          ? pricingExpectedValue(p.pricing, p.startDate.slice(0, 10), p.endDate?.slice(0, 10))
          : null,
        accrued:
          p.pricing?.type === 'TIMED'
            ? accruedAmount(p.loggedSeconds * 1000, p.pricing.hourlyRate)
            : null,
        createdAt: p.createdAt,
      })),
    [data],
  );
}
