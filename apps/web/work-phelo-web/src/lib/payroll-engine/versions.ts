import type { ConfigurationVersion, PayComponent, SavedConfiguration } from './types';

/** Today's date as YYYY-MM-DD in the user's own timezone. */
export function localIsoDate(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function latestVersion(config: SavedConfiguration): ConfigurationVersion {
  return config.versions[config.versions.length - 1];
}

/** JSON with sorted keys, so two components with the same settings compare equal. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sameComponents(a: PayComponent[], b: PayComponent[]): boolean {
  return canonical(a) === canonical(b);
}

/** The version a payroll run dated `date` uses: the latest one that has started by then. */
export function versionInForce(
  config: SavedConfiguration,
  date: string = localIsoDate(),
): ConfigurationVersion | null {
  const started = config.versions.filter((v) => v.effectiveFrom <= date);
  if (!started.length) return null;
  return started.reduce((best, v) =>
    v.effectiveFrom > best.effectiveFrom ||
    (v.effectiveFrom === best.effectiveFrom && v.version > best.version)
      ? v
      : best,
  );
}

export type VersionStatus = 'in_force' | 'scheduled' | 'earlier';

export function versionStatus(
  config: SavedConfiguration,
  version: ConfigurationVersion,
  today: string = localIsoDate(),
): VersionStatus {
  if (version.effectiveFrom > today) return 'scheduled';
  return versionInForce(config, today)?.version === version.version ? 'in_force' : 'earlier';
}

/** Plain-language list of what differs between two sets of components. */
export function diffComponents(before: PayComponent[], after: PayComponent[]): string[] {
  const old = new Map(before.map((c) => [c.id, c]));
  const next = new Map(after.map((c) => [c.id, c]));
  const out: string[] = [];
  after.forEach((c) => {
    const previous = old.get(c.id);
    if (!previous) out.push(`Added ${c.name}`);
    else if (canonical(previous) !== canonical(c)) out.push(`Changed ${c.name}`);
  });
  before.forEach((c) => {
    if (!next.has(c.id)) out.push(`Removed ${c.name}`);
  });
  return out;
}
