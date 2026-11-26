'use client';

import { TypeChip } from '@/components/atoms/TypeChip';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { ExportTimesheetButton } from '@/components/organisms/hr/projects/ExportTimesheetButton';
import { useProject, useProjectSetup } from '@/hooks';
import { useProjectLabels } from '@/hooks/useModuleLabels';
import { useProjectBillingLines } from '@/hooks/hr/useProjectBillingLines';
import { formatMoney, pricingExpectedValue } from '@/lib/projectPricing';
import { BILLING_TYPE_LABELS, PROJECT_TYPE_LABELS } from '@/lib/projectTypes';
import { formatHoursMinutes } from '@/lib/taskTime';
import type { ProjectBillingType } from '@/types/hr';

const PRICE_LABELS: Record<ProjectBillingType, string> = {
  FLAT_RATE: 'Price',
  TIMED: 'Accrued so far',
  MILESTONE: 'Milestone total',
  RETAINER: 'Retainer value',
};

const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

/** A figure in the overview, with an optional line under it. */
function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <DetailField
      label={label}
      value={
        <>
          {value}
          {note && <span className="block text-xs font-normal text-gray-400">{note}</span>}
        </>
      }
    />
  );
}

/** What the project is: who owns it, who it is for, how it is billed and when it runs. */
function ProjectDetails({ projectId }: { projectId: string }) {
  const labels = useProjectLabels();
  const { data: project } = useProject(projectId);
  const setup = useProjectSetup(projectId);
  if (!project) return null;
  const pricing = setup?.billable ? setup.pricing : undefined;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-x-6 gap-y-5">
      <DetailField label={`${labels.singular} Owner`} value={project.managerName ?? '—'} />
      <DetailField label="Type" value={project.kind ? PROJECT_TYPE_LABELS[project.kind] : '—'} />
      <DetailField label="Client" value={setup?.client?.name ?? '—'} />
      <DetailField
        label="Billing"
        value={pricing ? BILLING_TYPE_LABELS[pricing.type] : 'Not billable'}
      />
      <DetailField label="Start Date" value={formatDate(project.startDate)} />
      <DetailField label="End Date" value={formatDate(project.endDate)} />
      <DetailField
        label="Budget"
        value={project.budget == null ? '—' : formatMoney(project.budget)}
      />
      {project.description && (
        <div className="col-span-full">
          <DetailField label="Description" value={project.description} />
        </div>
      )}
    </div>
  );
}

/** What has been billed on a billable client project, and what is left. */
function BillingFigures({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId);
  const pricing = useProjectSetup(projectId)?.pricing;
  const { lines, invoiced, left, full } = useProjectBillingLines(projectId);
  if (!pricing) return null;
  const expected = pricingExpectedValue(
    pricing,
    project?.startDate?.slice(0, 10),
    project?.endDate?.slice(0, 10),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <Figure
          label={PRICE_LABELS[pricing.type]}
          value={formatMoney(full)}
          note={
            pricing.type === 'TIMED' && expected !== null
              ? `of ${formatMoney(expected)} expected`
              : pricing.type === 'RETAINER'
                ? `${formatMoney(pricing.monthlyAmount)} a month`
                : undefined
          }
        />
        <Figure label="Invoiced" value={formatMoney(invoiced)} />
        <Figure label="Left to bill" value={formatMoney(left)} />
      </div>
      {pricing.type === 'MILESTONE' && (
        <ul className="flex flex-col gap-2 max-h-40 overflow-y-auto">
          {lines.map((line) => (
            <li key={line.key} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate text-gray-900">{line.label}</span>
              <span className="text-xs text-gray-400">{line.detail}</span>
              <span className="tabular-nums text-gray-700">{formatMoney(line.amount)}</span>
              <TypeChip
                label={line.billed ? 'Billed' : 'To bill'}
                color={line.billed ? 'green' : 'gray'}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The billing figures in one line, for the collapsed overview. */
function BillingLine({ projectId }: { projectId: string }) {
  const pricing = useProjectSetup(projectId)?.pricing;
  const { invoiced, left, full } = useProjectBillingLines(projectId);
  if (!pricing) return null;

  return (
    <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
      {[
        [PRICE_LABELS[pricing.type], full],
        ['Invoiced', invoiced],
        ['Left to bill', left],
      ].map(([label, amount]) => (
        <div key={label} className="flex items-baseline gap-1.5">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
          <dd className="text-sm font-medium text-gray-800">{formatMoney(Number(amount))}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The hours logged against the estimate, and what that time is worth at the members' rates. */
function TimeFigures({
  projectId,
  totalMs,
  value,
  unrated,
}: {
  projectId: string;
  totalMs: number;
  value: number;
  /** The names of people with logged time and no rate. */
  unrated: string[];
}) {
  const { data: project } = useProject(projectId);
  const setup = useProjectSetup(projectId);
  const pricing = setup?.billable ? setup.pricing : undefined;

  // A retainer's estimate is per month, so the project's total hours aren't set against it.
  const estimatedHours = pricing?.type === 'RETAINER' ? undefined : pricing?.estimatedHours;
  const estimatedMs = (estimatedHours ?? 0) * 3_600_000;
  // What the value of the time is measured against: the expected amount on a project billed by time,
  // the budget on one that isn't billed. Other billing types are compared on the billing page.
  const price = !pricing
    ? (project?.budget ?? null)
    : pricing.type === 'TIMED'
      ? pricingExpectedValue(pricing)
      : null;
  const against = pricing ? 'expected amount' : 'budget';

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-4">
        <Figure
          label="Hours logged"
          value={formatHoursMinutes(totalMs)}
          note={estimatedMs > 0 ? `of ${estimatedHours} h estimated` : 'on timed tasks'}
        />
        <Figure
          label="Value of time"
          value={formatMoney(value)}
          note={
            price
              ? `${Math.round((value / price) * 100)}% of the ${formatMoney(price)} ${
                  pricing ? 'expected' : 'budget'
                }`
              : 'at each person’s rate'
          }
        />
      </div>
      {estimatedMs > 0 && (
        <ProgressBar value={Math.min(100, Math.round((totalMs / estimatedMs) * 100))} />
      )}
      {estimatedMs > 0 && totalMs > estimatedMs && (
        <p className="text-xs font-medium text-red-600">
          {formatHoursMinutes(totalMs - estimatedMs)} over the estimate
        </p>
      )}
      {!!price && value > price && (
        <p className="text-xs font-medium text-red-600">
          The time is worth {formatMoney(value - price)} more than the {against}
        </p>
      )}
      {unrated.length > 0 && (
        <p className="text-xs text-amber-600">
          No rate set for {unrated.join(', ')}, so their time isn’t valued.
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  /** Sits at the end of the title row. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3 border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * The whole project in one collapsible card: its details, then billing and time. The people filter
 * doesn't change any of it.
 */
export function ProjectOverview({ projectId, ...time }: React.ComponentProps<typeof TimeFigures>) {
  const setup = useProjectSetup(projectId);
  const billed = !!(setup?.billable && setup.pricing && setup.client);

  return (
    <CollapsibleOverview collapsedExtra={billed && <BillingLine projectId={projectId} />}>
      <div className="flex flex-col gap-5">
        <ProjectDetails projectId={projectId} />
        <div className={billed ? 'grid grid-cols-1 gap-x-10 gap-y-5 lg:grid-cols-2' : ''}>
          {billed && (
            <Section title="Billing">
              <BillingFigures projectId={projectId} />
            </Section>
          )}
          <Section title="Time" action={<ExportTimesheetButton projectId={projectId} />}>
            <TimeFigures projectId={projectId} {...time} />
          </Section>
        </div>
      </div>
    </CollapsibleOverview>
  );
}
