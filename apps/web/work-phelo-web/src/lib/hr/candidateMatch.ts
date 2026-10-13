import type { RecruitmentCandidateDetail, VacancyDetails } from '@/types/recruitment';

export interface MatchCriterion {
  key: 'skills' | 'experience' | 'languages';
  label: string;
  /** 0–100 */
  score: number;
  detail: string;
}

export interface MatchResult {
  /** 0–100, weighted over the criteria the job opening actually sets. */
  score: number;
  criteria: MatchCriterion[];
}

const WEIGHTS = { skills: 50, experience: 30, languages: 20 } as const;

function overlap(wanted: string[], have: string[]): { hit: number; total: number } {
  const owned = new Set(have.map((v) => v.trim().toLowerCase()));
  const hit = wanted.filter((w) => owned.has(w.trim().toLowerCase())).length;
  return { hit, total: wanted.length };
}

/**
 * Scores a candidate against what the job opening asked for. Only requirements the opening
 * actually sets count, so an opening without skills is not penalised for them. Returns null
 * when the opening sets none of skills, experience or languages.
 */
export function computeMatchScore(
  candidate: Pick<RecruitmentCandidateDetail, 'skills' | 'languages' | 'yearsOfExperience'>,
  requirements: VacancyDetails | null | undefined,
): MatchResult | null {
  if (!requirements) return null;
  const criteria: MatchCriterion[] = [];

  const skills = requirements.skills?.items ?? [];
  if (skills.length > 0) {
    const { hit, total } = overlap(skills, candidate.skills);
    criteria.push({
      key: 'skills',
      label: 'Skills',
      score: Math.round((hit / total) * 100),
      detail: `${hit} of ${total} required`,
    });
  }

  const minYears = requirements.experience?.minYears;
  if (minYears !== undefined && minYears > 0) {
    const years = candidate.yearsOfExperience ?? 0;
    criteria.push({
      key: 'experience',
      label: 'Experience',
      score: Math.min(100, Math.round((years / minYears) * 100)),
      detail: `${years} of ${minYears}+ years`,
    });
  }

  const languages = requirements.languages?.items ?? [];
  if (languages.length > 0) {
    const { hit, total } = overlap(languages, candidate.languages);
    criteria.push({
      key: 'languages',
      label: 'Languages',
      score: Math.round((hit / total) * 100),
      detail: `${hit} of ${total} required`,
    });
  }

  if (criteria.length === 0) return null;

  const totalWeight = criteria.reduce((sum, c) => sum + WEIGHTS[c.key], 0);
  const weighted = criteria.reduce((sum, c) => sum + c.score * WEIGHTS[c.key], 0);
  return { score: Math.round(weighted / totalWeight), criteria };
}
