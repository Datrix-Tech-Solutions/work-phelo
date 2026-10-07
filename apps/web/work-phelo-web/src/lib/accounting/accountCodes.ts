import type { GLAccountCategory } from '@/types/accounting';

/** The thousand-block each account type owns — mirrors the backend, which rejects any code
 *  outside it. */
export const CATEGORY_CODE_RANGES: Record<GLAccountCategory, { min: number; max: number }> = {
  ASSET: { min: 1000, max: 1999 },
  LIABILITY: { min: 2000, max: 2999 },
  EQUITY: { min: 3000, max: 3999 },
  REVENUE: { min: 4000, max: 4999 },
  EXPENSE: { min: 5000, max: 5999 },
};

export interface CodeBand {
  start: number;
  end: number;
}

/** The room a code leaves for what sits under it, read off its trailing zeros: 1100 owns
 *  1100–1199, 1110 owns 1110–1119, 1115 owns just itself. Same rule as the backend's. */
export function codeBand(code: number): CodeBand {
  let width = 1;
  while (width < 1000 && code % (width * 10) === 0) width *= 10;
  return { start: code, end: code + width - 1 };
}

export interface CodeSuggestion {
  /** The next free code, or null when there isn't one to offer. */
  code: string | null;
  /** The range the code has to sit in, e.g. "1110–1119". */
  range: string;
  /** Why there is no code, when there isn't one. */
  problem?: string;
}

const numeric = (codes: string[]) => codes.filter((c) => /^\d+$/.test(c)).map(Number);

/** The next code that is a multiple of `step` above `band.start` and inside the band. It goes
 *  one past the highest code already used; only when that is off the end of the band does it
 *  go back for a gap. `reserved` bands (a parent account's own range, say) are never used. */
function nextFree(band: CodeBand, step: number, used: number[], reserved: CodeBand[] = []) {
  const taken = new Set(used);
  const blocked = (code: number) => reserved.some((r) => code >= r.start && code <= r.end);
  const free = (code: number) => !taken.has(code) && !blocked(code);
  const inBand = used.filter((c) => c >= band.start && c <= band.end);
  const highest = inBand.length ? Math.max(...inBand) : band.start;
  const firstAfter = Math.floor((highest - band.start) / step) * step + step + band.start;
  for (let code = firstAfter; code <= band.end; code += step) if (free(code)) return code;
  for (let code = band.start + step; code <= band.end; code += step) if (free(code)) return code;
  return null;
}

function suggestion(band: CodeBand, code: number | null, whatFor: string): CodeSuggestion {
  const range = `${band.start}–${band.end}`;
  if (code !== null) return { code: String(code), range };
  return { code: null, range, problem: `No free code left in ${range} — ${whatFor}` };
}

/** A classification's code: the next hundred inside its type's block (1100, 1200, …). */
export function suggestClassificationCode(
  category: GLAccountCategory,
  existingCodes: string[],
): CodeSuggestion {
  const { min, max } = CATEGORY_CODE_RANGES[category];
  const band = { start: min, end: max };
  return suggestion(
    band,
    nextFree(band, 100, numeric(existingCodes)),
    'edit or remove an unused classification, or type a code by hand.',
  );
}

/** A parent account's code, inside its classification's range. */
export function suggestGroupCode(
  classificationCode: string,
  existingCodes: string[],
): CodeSuggestion {
  if (!/^\d+$/.test(classificationCode)) {
    return { code: null, range: '', problem: 'The classification code is not numeric.' };
  }
  const band = codeBand(Number(classificationCode));
  const step = Math.max(1, (band.end - band.start + 1) / 10);
  return suggestion(
    band,
    nextFree(band, step, numeric(existingCodes)),
    'choose another classification, or type a code by hand.',
  );
}

/** An account's code, inside its parent account's range (or its classification's, when it has
 *  none). `groupCodes` are the parent accounts sharing that classification, whose ranges an
 *  account posted directly under the classification must stay out of. */
export function suggestAccountCode(
  parentCode: string,
  usedCodes: string[],
  groupCodes: string[] = [],
): CodeSuggestion {
  if (!/^\d+$/.test(parentCode)) {
    return { code: null, range: '', problem: 'The parent code is not numeric.' };
  }
  const band = codeBand(Number(parentCode));
  if (band.start === band.end) {
    return {
      code: null,
      range: String(band.start),
      problem: `${parentCode} has no room for accounts under it — type a code by hand or choose another parent.`,
    };
  }
  const reserved = numeric(groupCodes)
    .map(codeBand)
    .filter((b) => b.start !== band.start);
  return suggestion(
    band,
    nextFree(band, 1, numeric(usedCodes), reserved),
    'choose another parent account, or type a code by hand.',
  );
}
