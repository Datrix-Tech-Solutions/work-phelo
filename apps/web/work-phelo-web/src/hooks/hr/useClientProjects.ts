import { useMemo } from 'react';
import { useProjectLocalStore } from '@/store/projectLocal.store';
import { pricingExpectedValue } from '@/lib/projectPricing';
import type { ProjectPricing } from '@/types/hr';

export interface ClientProject {
  id: string;
  name: string;
  billable: boolean;
  pricing?: ProjectPricing;
  /** What the client is expected to pay, from the project's pricing; null when there isn't one. */
  expectedValue: number | null;
  createdAt: string;
}

/** The projects started for a marketing client. From local storage until the project backend is rebuilt. */
export function useClientProjects(clientId: string): ClientProject[] {
  const byProjectId = useProjectLocalStore((s) => s.byProjectId);
  return useMemo(
    () =>
      Object.entries(byProjectId).flatMap(([id, d]) =>
        d.client?.id === clientId && d.summary
          ? [
              {
                id,
                name: d.summary.name,
                billable: !!d.billable,
                pricing: d.pricing,
                expectedValue: d.pricing
                  ? pricingExpectedValue(d.pricing, d.summary.startDate, d.summary.endDate)
                  : null,
                createdAt: d.summary.createdAt,
              },
            ]
          : [],
      ),
    [byProjectId, clientId],
  );
}
