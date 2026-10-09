'use client';

import { DashboardViewToggle } from '@/components/atoms/DashboardViewToggle';
import { PeriodToggle } from '@/components/atoms/PeriodToggle';
import { SearchSelect, type SearchSelectOption } from '@/components/atoms/SearchSelect';
import { YearSelect } from '@/components/atoms/YearSelect';
import type { DashboardFilters } from '@/hooks/useDashboardFilters';

/** An extra filter a module adds to the bar (currency, branch, campaign, …), rendered as a
 * search select. Its value lives in `filters.fieldValues[key]`. */
export interface DashboardFilterField {
  key: string;
  placeholder: string;
  options: SearchSelectOption[];
}

interface DashboardShellProps {
  filters: DashboardFilters;
  /** Extra search-select filters shown before the period toggle. None by default. */
  fields?: DashboardFilterField[];
  /** Show the General / Detailed toggle at the top right (default off). Read `filters.view` to switch content. */
  showViewToggle?: boolean;
  /** Extra right-aligned slot in the filter bar row (export button, …). */
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

/** Page frame shared by module dashboards: scroll container, filter bar, vertical rhythm.
 * Each module arranges its own content as children. */
export function DashboardShell({
  filters,
  fields = [],
  showViewToggle = false,
  actions,
  children,
}: DashboardShellProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto py-6 pr-6 pl-(--page-pl) space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {fields.map((field) => (
            <div key={field.key} className="w-64">
              <SearchSelect
                placeholder={field.placeholder}
                options={field.options}
                value={filters.fieldValues[field.key] ?? ''}
                onChange={(value) => filters.setFieldValue(field.key, value)}
                size="sm"
                showAllOption
              />
            </div>
          ))}
          {filters.period === 'yearly' && (
            <YearSelect value={filters.year} onChange={filters.setYear} />
          )}
          <PeriodToggle value={filters.period} onChange={filters.setPeriod} />
        </div>
        <div className="flex items-center gap-3 ml-auto">
          {actions}
          {showViewToggle && (
            <DashboardViewToggle value={filters.view} onChange={filters.setView} />
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
