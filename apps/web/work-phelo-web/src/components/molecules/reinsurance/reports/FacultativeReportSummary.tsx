'use client';

import { ShieldCheck, Clock, CheckCircle2 } from 'lucide-react';
import { MetricCard } from '@/components/molecules/shared/MetricCard';
import { FacultativeReportSummary as FacultativeReportSummaryData } from '@/hooks/reinsurance/useFacultativeReport';

interface FacultativeReportSummaryProps {
  summary: FacultativeReportSummaryData;
  isLoading: boolean;
}

export function FacultativeReportSummary({ summary, isLoading }: FacultativeReportSummaryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
      <MetricCard
        label="Total Offers"
        value={isLoading ? '—' : summary.totalOffers}
        icon={ShieldCheck}
      />
      <MetricCard
        label="Open Offers"
        value={isLoading ? '—' : summary.openOffers}
        icon={Clock}
        variant="warning"
      />
      <MetricCard
        label="Acceptance Rate"
        value={isLoading ? '—' : `${summary.acceptanceRate.toFixed(1)}%`}
        icon={CheckCircle2}
      />
    </div>
  );
}
