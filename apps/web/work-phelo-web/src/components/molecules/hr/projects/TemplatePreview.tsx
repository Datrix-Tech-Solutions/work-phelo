'use client';

import { useState } from 'react';
import { Calendar, Columns3, List, ListTree, Target } from 'lucide-react';
import { PROJECT_FEATURE_LABELS } from '@/lib/projectFeatures';
import { PriorityDot } from '@/lib/priorityColors';
import { WorkTypeIconBadge } from '@/lib/workTypeIcons';
import { cn } from '@/lib/utils';
import type { ProjectConfig, ProjectFeature, ProjectTemplateContent } from '@/types/hr';

const FEATURE_ICONS: Record<ProjectFeature, typeof List> = {
  OBJECTIVES: Target,
  BOARD: Columns3,
  BACKLOG: ListTree,
  CALENDAR: Calendar,
  LIST: List,
};

interface Props {
  name: string;
  config: ProjectConfig;
  /** The tabs that are on, in order, each with the name it shows. */
  tabs: { feature: ProjectFeature; label: string }[];
  objectives: string[];
  /** The sprints the backlog shows; a sample one stands in when there are none. */
  sprintNames?: string[];
  /** The tab shown first, if it is on. */
  initialFeature?: ProjectFeature;
}

const ALL_FEATURES = Object.keys(PROJECT_FEATURE_LABELS) as ProjectFeature[];

/** The tabs a project shows: the features that are on, in their usual order, under the names given. */
export function previewTabs(
  features: ProjectFeature[],
  labels: ProjectTemplateContent['featureLabels'],
) {
  return ALL_FEATURES.filter((f) => features.includes(f)).map((feature) => ({
    feature,
    label: labels[feature] ?? PROJECT_FEATURE_LABELS[feature],
  }));
}

/** A grey stand-in for text, so the preview shows layout without pretending to be real work. */
function Scribble({ className }: { className?: string }) {
  return <span className={cn('block h-2 rounded-full bg-gray-200', className)} />;
}

/** A sample task: which work type and priority it gets is cycled from the template. */
function sample(config: ProjectConfig, i: number) {
  return {
    key: `KEY-${i + 1}`,
    workType: config.workTypes[i % Math.max(config.workTypes.length, 1)],
    priority: config.priorities[i % Math.max(config.priorities.length, 1)],
    status: config.workflow[i % Math.max(config.workflow.length, 1)],
  };
}

function BoardPreview({ config }: { config: ProjectConfig }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {config.workflow.map((status, col) => (
        <div key={col} className="w-44 shrink-0 rounded-lg bg-gray-50 p-3 flex flex-col gap-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600 truncate">
            {status || 'Status'}
          </p>
          {Array.from({ length: col === config.workflow.length - 1 ? 1 : 2 }, (_, n) => {
            const s = sample(config, col + n * config.workflow.length);
            return (
              <div
                key={n}
                className="rounded-md bg-white p-2.5 shadow-sm border border-gray-100 flex flex-col gap-2.5"
              >
                <Scribble className="w-4/5" />
                <div className="flex items-center gap-1.5">
                  {s.workType && <WorkTypeIconBadge icon={s.workType.icon} />}
                  <span className="text-[11px] font-medium text-gray-600">{s.key}</span>
                  {s.priority && <PriorityDot color={s.priority.color} className="ml-auto" />}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ListPreview({
  config,
  heading,
  offset = 0,
  rows = 5,
}: {
  config: ProjectConfig;
  heading?: string;
  offset?: number;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      {heading && <p className="text-xs font-bold text-gray-700">{heading}</p>}
      {Array.from({ length: rows }, (_, i) => {
        const s = sample(config, i + offset);
        return (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md border border-gray-100 bg-white px-3 py-2"
          >
            {s.workType && <WorkTypeIconBadge icon={s.workType.icon} />}
            <span className="w-14 shrink-0 text-[11px] font-medium text-gray-600">{s.key}</span>
            <Scribble className="flex-1" />
            <span className="max-w-24 truncate rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
              {s.status || 'Status'}
            </span>
            {s.priority && <PriorityDot color={s.priority.color} />}
          </div>
        );
      })}
    </div>
  );
}

function CalendarPreview({ config }: { config: ProjectConfig }) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: 35 }, (_, i) => {
        const s = i % 6 === 2 ? sample(config, i) : null;
        return (
          <div key={i} className="h-14 rounded border border-gray-100 bg-white p-1">
            <span className="text-[10px] text-gray-400">{(i % 30) + 1}</span>
            {s?.workType && (
              <div className="mt-0.5 flex items-center gap-1 rounded bg-gray-100 px-1 py-0.5">
                <WorkTypeIconBadge icon={s.workType.icon} className="!w-3 !h-3" />
                <Scribble className="h-1.5 flex-1" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ObjectivesPreview({ objectives }: { objectives: string[] }) {
  const names = objectives.length ? objectives : ['Objective one', 'Objective two'];
  return (
    <div className="grid grid-cols-2 gap-3">
      {names.slice(0, 6).map((n, i) => (
        <div key={i} className="rounded-lg border border-gray-100 bg-white p-3 flex flex-col gap-2">
          <p className="text-sm font-semibold text-gray-800 truncate">{n}</p>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-brand" style={{ width: `${25 + i * 20}%` }} />
          </div>
          <Scribble className="w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** A live picture of a project built from the template, using the names and settings being edited. */
export function TemplatePreview({
  name,
  config,
  tabs,
  objectives,
  sprintNames = [],
  initialFeature,
}: Props) {
  const [picked, setPicked] = useState<ProjectFeature | null>(initialFeature ?? null);
  const active = tabs.find((t) => t.feature === picked)?.feature ?? tabs[0]?.feature;

  return (
    <div className="rounded-xl bg-white p-5 shadow-md flex flex-col gap-4 min-w-0">
      <div>
        <p className="text-xs text-gray-500">Preview</p>
        <p className="text-lg font-bold text-gray-900 truncate">{name.trim() || 'Template name'}</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {tabs.map(({ feature, label }) => {
          const Icon = FEATURE_ICONS[feature];
          return (
            <button
              key={feature}
              type="button"
              onClick={() => setPicked(feature)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                feature === active
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-600 hover:text-gray-900',
              )}
            >
              <Icon className="w-4 h-4" />
              {label || 'Tab'}
            </button>
          );
        })}
      </div>

      {tabs.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-400">
          Turn on a view to see how the project looks.
        </p>
      )}
      {active === 'BOARD' && <BoardPreview config={config} />}
      {active === 'BACKLOG' && (
        <div className="flex flex-col gap-4">
          {(sprintNames.length ? sprintNames.slice(0, 3) : ['Sprint 1']).map((n, i) => (
            <ListPreview key={n} config={config} heading={n} offset={i * 3} rows={3} />
          ))}
        </div>
      )}
      {active === 'LIST' && <ListPreview config={config} />}
      {active === 'CALENDAR' && <CalendarPreview config={config} />}
      {active === 'OBJECTIVES' && <ObjectivesPreview objectives={objectives} />}
    </div>
  );
}
