export type NameMatchResult =
  | { status: 'found'; id: string }
  | { status: 'not_found' }
  | { status: 'ambiguous' };

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Resolves a "First Last" full-name string against a list of employee candidates.
 *  Used for bulk-import name lookups (reporting manager, branch manager, department head),
 *  which are optional — callers should drop the field and warn on 'not_found'/'ambiguous'
 *  rather than failing the row. */
export function matchEmployeeByFullName(
  fullName: string,
  candidates: { id: string; firstName: string; lastName: string }[],
): NameMatchResult {
  const normalized = normalizeName(fullName);
  const matches = candidates.filter(
    (c) => normalizeName(`${c.firstName} ${c.lastName}`) === normalized,
  );
  if (matches.length === 1) return { status: 'found', id: matches[0].id };
  if (matches.length === 0) return { status: 'not_found' };
  return { status: 'ambiguous' };
}

/** Case-insensitive, whitespace-trimmed match of a name against a list of {id, name} records
 *  (departments, branches). Names are unique per tenant so this never returns ambiguous. */
export function matchByExactName<T extends { id: string; name: string }>(
  name: string,
  candidates: T[],
): T | undefined {
  const normalized = normalizeName(name);
  return candidates.find((c) => normalizeName(c.name) === normalized);
}
