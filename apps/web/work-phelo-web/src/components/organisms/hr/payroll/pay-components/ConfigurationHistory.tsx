'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { TypeChip, type TypeChipColor } from '@/components/atoms/TypeChip';
import { cn, cardClass } from '@/lib/utils';
import {
  PAYSLIP_TYPES,
  diffComponents,
  latestVersion,
  versionInForce,
  versionStatus,
  type ConfigurationVersion,
  type PayComponent,
  type SavedConfiguration,
  type VersionStatus,
} from '@/lib/payroll-engine';

const STATUS: Record<VersionStatus, { label: string; color: TypeChipColor }> = {
  in_force: { label: 'In force', color: 'green' },
  scheduled: { label: 'Scheduled', color: 'amber' },
  earlier: { label: 'Earlier', color: 'gray' },
};

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

interface ConfigurationHistoryProps {
  loading?: boolean;
  configurations: SavedConfiguration[];
  /** The configuration open in the editor, expanded first. */
  currentId: string | null;
  /** The draft being edited, to list what has changed since the open configuration's latest version. */
  draft: PayComponent[];
  dirty: boolean;
  onLoad: (configuration: SavedConfiguration, version: ConfigurationVersion) => void;
}

function VersionList({
  configuration,
  draft,
  showDraft,
  onLoad,
}: {
  configuration: SavedConfiguration;
  draft: PayComponent[];
  showDraft: boolean;
  onLoad: ConfigurationHistoryProps['onLoad'];
}) {
  const versions = [...configuration.versions].reverse();
  const draftChanges = showDraft
    ? diffComponents(latestVersion(configuration).components, draft)
    : [];

  return (
    <ul className="divide-y divide-gray-200 border-t border-gray-200 px-4">
      {showDraft && (
        <li className="grid grid-cols-[auto_1fr] items-start gap-x-4 gap-y-1 py-3">
          <span className="text-lg font-bold text-gray-900">Draft</span>
          <div>
            <TypeChip label="Unsaved changes" color="amber" />
            <ul className="mt-1.5 list-disc pl-5 text-xs text-gray-600">
              {draftChanges.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </div>
        </li>
      )}
      {versions.map((v, index) => {
        const previous = versions[index + 1];
        const changes = previous
          ? diffComponents(previous.components, v.components)
          : ['First version'];
        const status = STATUS[versionStatus(configuration, v)];
        return (
          <li
            key={v.version}
            className="grid grid-cols-[auto_1fr_auto] items-start gap-x-4 gap-y-1 py-3"
          >
            <span className="text-lg font-bold text-gray-900">v{v.version}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{v.note || 'No note'}</span>
                <TypeChip label={status.label} color={status.color} />
              </div>
              <div className="text-xs text-gray-500">
                Takes effect {formatDate(v.effectiveFrom)} · saved{' '}
                {formatDate(v.savedAt.slice(0, 10))}
              </div>
              <ul className="mt-1.5 list-disc pl-5 text-xs text-gray-600">
                {changes.length ? (
                  changes.map((change) => <li key={change}>{change}</li>)
                ) : (
                  <li>No component changes</li>
                )}
              </ul>
            </div>
            <Button variant="outline" size="sm" onClick={() => onLoad(configuration, v)}>
              Load into draft
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export function ConfigurationHistory({
  loading = false,
  configurations,
  currentId,
  draft,
  dirty,
  onLoad,
}: ConfigurationHistoryProps) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(currentId ? [currentId] : []));

  const toggle = (id: string) =>
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loading) {
    return <div className={cardClass('p-6 text-center text-sm text-gray-500')}>Loading…</div>;
  }

  if (!configurations.length) {
    return (
      <div className={cardClass('p-6 text-center text-sm text-gray-500')}>
        Save a configuration to start its history. Each save that changes the components adds a
        version here, with the date it takes effect.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-2xl text-xs text-gray-500">
        When a rate or rule changes, save a new version instead of editing the old one. Payroll runs
        dated before a version takes effect keep using the earlier version, so past payslips can
        always be explained. Tap a configuration to see its versions.
      </p>

      {configurations.map((configuration) => {
        const expanded = open.has(configuration.id);
        const inForce = versionInForce(configuration);
        const isCurrent = configuration.id === currentId;
        return (
          <section key={configuration.id} className={cardClass('overflow-hidden')}>
            <button
              type="button"
              onClick={() => toggle(configuration.id)}
              aria-expanded={expanded}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-gray-900">
                    {configuration.name}
                  </span>
                  {configuration.payslipType && (
                    <TypeChip label={PAYSLIP_TYPES[configuration.payslipType].label} color="blue" />
                  )}
                  {isCurrent && dirty && <TypeChip label="Unsaved changes" color="amber" />}
                </span>
                <span className="text-xs text-gray-500">
                  {configuration.versions.length}{' '}
                  {configuration.versions.length === 1 ? 'version' : 'versions'}
                  {inForce ? ` · version ${inForce.version} in force` : ' · none in force yet'}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-gray-400 transition-transform',
                  !expanded && '-rotate-90',
                )}
              />
            </button>
            {expanded && (
              <VersionList
                configuration={configuration}
                draft={draft}
                showDraft={isCurrent && dirty}
                onLoad={onLoad}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
