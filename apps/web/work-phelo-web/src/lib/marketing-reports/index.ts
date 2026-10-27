import { campaignPerformance, campaignTrend } from './campaign';
import {
  appointmentsReport,
  clientReport,
  growthTrend,
  prospectListing,
  salesPerformance,
  targetAchievement,
} from './crm';
import { transportRequests, transportTrend, vehicleDriverUsage } from './transport';
import type { ReportDefinition, ReportSection } from './types';

export const MARKETING_REPORTS: ReportDefinition[] = [
  prospectListing,
  clientReport,
  appointmentsReport,
  salesPerformance,
  targetAchievement,
  growthTrend,
  campaignPerformance,
  campaignTrend,
  transportRequests,
  vehicleDriverUsage,
  transportTrend,
];

export const REPORT_SECTIONS: { key: ReportSection; label: string }[] = [
  { key: 'crm', label: 'Sales CRM' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'transport', label: 'Transport' },
];

export function findReport(key: string): ReportDefinition | undefined {
  return MARKETING_REPORTS.find((r) => r.key === key);
}

export * from './types';
