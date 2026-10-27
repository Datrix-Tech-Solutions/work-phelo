'use client';

import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useMarketingDashboardReps } from '@/hooks/marketing/useMarketingDashboardReps';
import { useAppointmentFormOptions } from '@/hooks/marketing/useAppointments';
import { useProspectingSettings } from '@/hooks/marketing/useProspectingSettings';
import { useTargetReportFilters } from '@/hooks/marketing/useTargetReport';
import { usePipelineStages } from '@/hooks/marketing/usePipelineStages';
import type { ReportFilter, ReportValues } from '@/lib/marketing-reports';
import type { ProspectingSettingSlug } from '@/types/marketing';

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => ({
  value: String(thisYear - i),
  label: String(thisYear - i),
}));

interface Props {
  filters: ReportFilter[];
  values: ReportValues;
  onChange: (values: ReportValues) => void;
}

/** One CRM setting list (products, source types, …) as an All-or-one picker. */
function SettingFilter({
  label,
  slug,
  value,
  onChange,
}: {
  label: string;
  slug: ProspectingSettingSlug;
  value: string;
  onChange: (value: string) => void;
}) {
  const { data: items = [] } = useProspectingSettings(slug);
  return (
    <div className="w-56">
      <SearchSelect
        label={label}
        placeholder="All"
        allLabel="All"
        options={items.map((i) => ({ value: i.id, label: i.name }))}
        value={value}
        onChange={onChange}
        showAllOption
      />
    </div>
  );
}

/** The inputs a report declares, in the order it declares them. */
export function ReportFilterFields({ filters, values, onChange }: Props) {
  const needsReps = filters.some((f) => f.kind === 'rep');
  const { data: reps = [] } = useMarketingDashboardReps(needsReps);
  const { data: stages = [] } = usePipelineStages();
  const { data: appointmentOptions } = useAppointmentFormOptions(
    {},
    filters.some((f) => f.kind === 'marketer'),
  );
  const { data: targetFilters } = useTargetReportFilters(
    filters.some((f) => f.kind === 'targetRep' || f.kind === 'branch' || f.kind === 'department'),
  );

  const set = (key: string, value: string) => onChange({ ...values, [key]: value });
  const field = 'w-56';

  return (
    <>
      {filters.map((filter) => {
        if (filter.kind === 'dateRange') {
          return (
            <div key="range" className="flex items-end gap-3">
              <div className={field}>
                <DatePicker
                  label={`${filter.label} from`}
                  value={values.from}
                  maxDate={values.to || undefined}
                  onChange={(v) => set('from', v)}
                />
              </div>
              <div className={field}>
                <DatePicker
                  label="To"
                  value={values.to}
                  minDate={values.from || undefined}
                  onChange={(v) => set('to', v)}
                />
              </div>
            </div>
          );
        }
        if (filter.kind === 'year') {
          return (
            <div key="year" className="w-40">
              <SearchSelect
                label={filter.label}
                options={YEARS}
                value={values.year}
                onChange={(v) => set('year', v)}
                clearable={false}
              />
            </div>
          );
        }
        if (filter.kind === 'setting') {
          return (
            <SettingFilter
              key={filter.key}
              label={filter.label}
              slug={filter.slug}
              value={values[filter.key] ?? ''}
              onChange={(v) => set(filter.key, v)}
            />
          );
        }
        let options: { value: string; label: string }[] = [];
        if (filter.kind === 'select') options = filter.options;
        else if (filter.kind === 'rep')
          options = reps.map((r) => ({ value: r.userId, label: r.name }));
        else if (filter.kind === 'marketer')
          options = (appointmentOptions?.marketers ?? []).map((m) => ({
            value: m.id,
            label: m.name,
          }));
        else if (filter.kind === 'stage')
          options = stages.map((st) => ({ value: st.id, label: st.name }));
        else if (filter.kind === 'targetRep')
          options = (targetFilters?.reps ?? []).map((r) => ({ value: r.userId, label: r.name }));
        else if (filter.kind === 'branch')
          options = (targetFilters?.branches ?? []).map((b) => ({ value: b.id, label: b.name }));
        else if (filter.kind === 'department')
          options = (targetFilters?.departments ?? []).map((d) => ({ value: d.id, label: d.name }));

        // Someone who can only see themselves, or a company with no branches, has nothing to pick.
        const optional = ['rep', 'marketer', 'targetRep', 'branch', 'department'].includes(
          filter.kind,
        );
        if (
          optional &&
          (options.length === 0 ||
            ((filter.kind === 'targetRep' || filter.kind === 'rep' || filter.kind === 'marketer') &&
              options.length < 2))
        )
          return null;

        return (
          <div key={filter.key} className={field}>
            <SearchSelect
              label={filter.label}
              placeholder={`All`}
              allLabel="All"
              options={options}
              value={values[filter.key] ?? ''}
              onChange={(v) => set(filter.key, v)}
              showAllOption
            />
          </div>
        );
      })}
    </>
  );
}
