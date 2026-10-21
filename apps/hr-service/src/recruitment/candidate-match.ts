import {
  RECRUITMENT_EDUCATION_LEVEL_CODES,
  educationLevelCode,
} from './vacancy-requirements';

/** Requirements kept in `RecruitmentVacancy.details` that take part in the match score. */
interface MatchRequirements {
  skills?: { items?: string[] };
  languages?: { items?: string[] };
  certificates?: { items?: string[] };
  experience?: { minYears?: number };
  education?: { levels?: string[] };
}

export interface MatchSubject {
  skills: string[];
  languages: string[];
  certificates: string[];
  yearsOfExperience: number | null;
  highestEducationLevel: string | null;
}

// Keep in step with apps/web/work-phelo-web/src/lib/hr/candidateMatch.ts.
const WEIGHTS = {
  skills: 5,
  experience: 40,
  languages: 10,
  certificates: 25,
  education: 20,
} as const;

function overlapPercent(wanted: string[], have: string[]): number {
  const owned = new Set(have.map((value) => value.trim().toLowerCase()));
  const hit = wanted.filter((item) =>
    owned.has(item.trim().toLowerCase()),
  ).length;
  return Math.round((hit / wanted.length) * 100);
}

/**
 * Full marks when the applicant's highest level reaches the lowest level the vacancy accepts;
 * below that, the share of the way up the ladder they have reached.
 */
function educationPercent(accepted: string[], highest: string | null): number {
  const ranks = accepted
    .map((level) => RECRUITMENT_EDUCATION_LEVEL_CODES.indexOf(level))
    .filter((rank) => rank >= 0);
  if (ranks.length === 0) return 100;
  const code = educationLevelCode(highest);
  const have = code ? RECRUITMENT_EDUCATION_LEVEL_CODES.indexOf(code) : -1;
  if (have < 0) return 0;
  const lowest = Math.min(...ranks);
  if (have >= lowest) return 100;
  return Math.round((have / lowest) * 100);
}

/**
 * 0-100 score of an applicant against what the vacancy asks for, weighted over the
 * requirements the vacancy actually sets. Null when it sets none of skills, certificates,
 * minimum experience, education or languages, so there is nothing to score against.
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

  const certificates = requirements.certificates?.items ?? [];
  if (certificates.length > 0) {
    parts.push({
      weight: WEIGHTS.certificates,
      score: overlapPercent(certificates, subject.certificates),
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

  const levels = requirements.education?.levels ?? [];
  if (levels.length > 0) {
    parts.push({
      weight: WEIGHTS.education,
      score: educationPercent(levels, subject.highestEducationLevel),
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

/** In Screening the score is half the application's match and half the screening. */
const SCREENING_SHARE = 50;

export interface ScreeningTally {
  /** Active screening questions on the vacancy. */
  total: number;
  accepted: number;
  /** Answers the reviewer has accepted or declined. */
  decided: number;
}

/**
 * The score a candidate shows: the application's match, blended with the screening once the
 * reviewer has decided on at least one answer. When only one of the two can be scored it stands
 * alone; null when neither can. Keep in step with `overallScore` in
 * apps/web/work-phelo-web/src/lib/hr/candidateMatch.ts.
 */
export function computeOverallScore(
  subject: MatchSubject,
  details: unknown,
  screening: ScreeningTally,
): number | null {
  const application = computeMatchScore(subject, details);
  const screeningScore =
    screening.total > 0 && screening.decided > 0
      ? Math.round((screening.accepted / screening.total) * 100)
      : null;
  if (application !== null && screeningScore !== null) {
    return Math.round(
      (application * (100 - SCREENING_SHARE) +
        screeningScore * SCREENING_SHARE) /
        100,
    );
  }
  return application ?? screeningScore;
}
