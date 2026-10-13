import type { SourceModule } from '@/types/accounting';

/** What a record from each module is called, shown instead of the raw reference stored on its entity. */
const SOURCE_RECORD_LABELS: Partial<Record<SourceModule, string>> = {
  MARKETING: 'Marketing client',
};

/**
 * Entities another module creates carry a reference like `MARKETING:<client id>`, which means
 * nothing to a person. This returns the plain name of the kind of record it points at (e.g.
 * "Marketing client"), or null when the reference is not one of those.
 */
export function sourceRecordLabel(externalRef: string): string | null {
  const separator = externalRef.indexOf(':');
  if (separator <= 0) return null;
  return SOURCE_RECORD_LABELS[externalRef.slice(0, separator) as SourceModule] ?? null;
}

export const SOURCE_MODULE_LABELS: Record<SourceModule, string> = {
  HR: 'HR',
  MARKETING: 'Marketing',
  ACCOUNTING: 'Accounting',
  RECRUITMENT: 'Recruitment',
  OPERATIONS: 'Operations',
};
