/** Requirements kept in `RecruitmentVacancy.details` that take part in the match score. */
interface MatchRequirements {
  skills?: { items?: string[] };
  languages?: { items?: string[] };
  experience?: { minYears?: number };
}

export interface MatchSubject {
  skills: string[];
  languages: string[];
  yearsOfExperience: number | null;
}

// Keep in step with apps/web/work-phelo-web/src/lib/hr/candidateMatch.ts.
const WEIGHTS = { skills: 50, experience: 30, languages: 20 } as const;

function overlapPercent(wanted: string[], have: string[]): number {
  const owned = new Set(have.map((value) => value.trim().toLowerCase()));
  const hit = wanted.filter((item) =>
    owned.has(item.trim().toLowerCase()),
  ).length;
  return Math.round((hit / wanted.length) * 100);
}

/**
 * 0-100 score of an applicant against what the vacancy asks for, weighted over the
 * requirements the vacancy actually sets. Null when it sets none of skills, minimum
 * experience or languages, so there is nothing to score against.
 */
export function computeMatchScore(
  subject: MatchSubject,
  details: unknown,
): number | null {
  if (!details || typeof details !== 'object') return null;
  const requirements = details as MatchRequirements;
  const parts: Array<{ weight: number; score: number }> = [];

  const skills = requirements.skills?.items ?? [];
  if (skills.length > 0) {
    parts.push({
      weight: WEIGHTS.skills,
      score: overlapPercent(skills, subject.skills),
    });
  }

  const minYears = requirements.experience?.minYears;
  if (minYears !== undefined && minYears > 0) {
    const years = subject.yearsOfExperience ?? 0;
    parts.push({
      weight: WEIGHTS.experience,
      score: Math.min(100, Math.round((years / minYears) * 100)),
    });
  }

  const languages = requirements.languages?.items ?? [];
  if (languages.length > 0) {
    parts.push({
      weight: WEIGHTS.languages,
      score: overlapPercent(languages, subject.languages),
    });
  }

  if (parts.length === 0) return null;
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  const weighted = parts.reduce(
    (sum, part) => sum + part.score * part.weight,
    0,
  );
  return Math.round(weighted / totalWeight);
}
