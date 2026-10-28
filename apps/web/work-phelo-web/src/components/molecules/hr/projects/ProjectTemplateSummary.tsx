import { ProjectConfig, ProjectFeature } from '@/types/hr';
import { PROJECT_FEATURE_LABELS } from '@/lib/projectFeatures';
import { PRIORITY_COLORS, PriorityDot } from '@/lib/priorityColors';
import { WorkTypeIconBadge } from '@/lib/workTypeIcons';

function ChipSection({
  title,
  items,
  chipClass,
}: {
  title: string;
  items: string[];
  chipClass: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${chipClass}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A template's or project's features, workflow, priority levels and work types, as labelled chip rows. */
export function ProjectTemplateSummary({
  template,
  featureLabels = {},
}: {
  template: ProjectConfig;
  /** Names given to features, which show in place of the usual ones. */
  featureLabels?: Partial<Record<ProjectFeature, string>>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ChipSection
        title="Features"
        items={template.features.map((f) => featureLabels[f] ?? PROJECT_FEATURE_LABELS[f])}
        chipClass="bg-emerald-50 text-emerald-700"
      />
      <ChipSection
        title="Workflow"
        items={template.workflow}
        chipClass="bg-brand-tint text-brand"
      />
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Priority levels
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {template.priorities.map((p, i) => (
            <span
              key={`${p.name}-${i}`}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${PRIORITY_COLORS[p.color].chip}`}
            >
              <PriorityDot color={p.color} className="w-2 h-2" />
              {p.name}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Work types
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {template.workTypes.map((w, i) => (
            <span
              key={`${w.name}-${i}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium pl-1.5 pr-2.5 py-1 rounded-full bg-gray-100 text-gray-700"
            >
              <WorkTypeIconBadge icon={w.icon} />
              {w.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
