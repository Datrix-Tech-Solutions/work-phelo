import type {
  RecruitmentCandidateDetail,
  RecruitmentVacancyQuestion,
  ScreeningDecisions,
  VacancyDetails,
} from '@/types/recruitment';
import { educationLevelLabel, educationLevelRank } from '@/lib/hr/educationLevels';

export interface MatchCriterion {
  key: 'skills' | 'certificates' | 'experience' | 'education' | 'languages' | 'screening';
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

// Keep in step with apps/hr-service/src/recruitment/candidate-match.ts.
const WEIGHTS = {
  skills: 5,
  experience: 40,
  languages: 10,
  certificates: 25,
  education: 20,
} as const;

type PartKey = keyof typeof WEIGHTS;

interface Part {
  key: PartKey;
  label: string;
  /** 0–100 */
  score: number;
  detail: string;
}

function overlap(wanted: string[], have: string[]): { hit: number; total: number } {
  const owned = new Set(have.map((v) => v.trim().toLowerCase()));
  const hit = wanted.filter((w) => owned.has(w.trim().toLowerCase())).length;
  return { hit, total: wanted.length };
}

/**
 * Scores a candidate against what the job opening asked for. Only requirements the opening
 * actually sets count, so an opening without skills is not penalised for them. Returns null
 * when the opening sets none of skills, certificates, experience, education or languages.
 */
export function computeMatchScore(
  candidate: Pick<
    RecruitmentCandidateDetail,
    'skills' | 'languages' | 'certificates' | 'yearsOfExperience' | 'highestEducationLevel'
  >,
  requirements: VacancyDetails | null | undefined,
): MatchResult | null {
  if (!requirements) return null;
  const parts: Part[] = [];

  const skills = requirements.skills?.items ?? [];
  if (skills.length > 0) {
    const { hit, total } = overlap(skills, candidate.skills);
    parts.push({
      key: 'skills',
      label: 'Skills',
      score: Math.round((hit / total) * 100),
      detail: `${hit} of ${total} skills`,
    });
  }

  const certificates = requirements.certificates?.items ?? [];
  if (certificates.length > 0) {
    const { hit, total } = overlap(certificates, candidate.certificates);
    parts.push({
      key: 'certificates',
      label: 'Certificates',
      score: Math.round((hit / total) * 100),
      detail: `${hit} of ${total} certificates`,
    });
  }

  const minYears = requirements.experience?.minYears;
  if (minYears !== undefined && minYears > 0) {
    const years = candidate.yearsOfExperience ?? 0;
    parts.push({
      key: 'experience',
      label: 'Experience',
      score: Math.min(100, Math.round((years / minYears) * 100)),
      detail: `${years} of ${minYears}+ years`,
    });
  }

  const levels = requirements.education?.levels ?? [];
  const ranks = levels.map(educationLevelRank).filter((rank) => rank >= 0);
  if (ranks.length > 0) {
    const lowest = Math.min(...ranks);
    const have = candidate.highestEducationLevel
      ? educationLevelRank(candidate.highestEducationLevel)
      : -1;
    parts.push({
      key: 'education',
      label: 'Education',
      score: have < 0 ? 0 : have >= lowest ? 100 : Math.round((have / lowest) * 100),
      detail: candidate.highestEducationLevel
        ? educationLevelLabel(candidate.highestEducationLevel)
        : 'No education level',
    });
  }

  const languages = requirements.languages?.items ?? [];
  if (languages.length > 0) {
    const { hit, total } = overlap(languages, candidate.languages);
    parts.push({
      key: 'languages',
      label: 'Languages',
      score: Math.round((hit / total) * 100),
      detail: `${hit} of ${total} languages`,
    });
  }

  if (parts.length === 0) return null;

  const totalWeight = parts.reduce((sum, p) => sum + WEIGHTS[p.key], 0);
  const weighted = parts.reduce((sum, p) => sum + p.score * WEIGHTS[p.key], 0);
  return { score: Math.round(weighted / totalWeight), criteria: parts };
}

/** Whether the Screening stage's own bar applies to the candidate. */
export function isScreeningStage(stageName: string | null | undefined): boolean {
  return stageName?.trim().toLowerCase() === 'screening';
}

/**
 * Share of the job opening's screening questions the reviewer has accepted. Null while the
 * opening has no screening questions or the reviewer has not decided any, so a candidate whose
 * screening was skipped is scored on the application alone.
 */
export function computeScreeningScore(
  decisions: ScreeningDecisions,
  questions: RecruitmentVacancyQuestion[],
): MatchCriterion | null {
  if (questions.length === 0 || !questions.some((q) => decisions[q.id])) return null;
  const accepted = questions.filter((q) => decisions[q.id] === 'ACCEPTED').length;
  const pending = questions.filter((q) => !decisions[q.id]).length;
  return {
    key: 'screening',
    label: 'Screening questions',
    score: Math.round((accepted / questions.length) * 100),
    detail:
      `${accepted} of ${questions.length} accepted` + (pending > 0 ? ` · ${pending} pending` : ''),
  };
}

/** In the Screening stage the score is half the application's match and half the screening. */
export const SCREENING_SHARE = 50;

/**
 * The score a candidate shows. Outside Screening it is the application's match alone; in
 * Screening it is split evenly with the screening bar. When only one of the two can be scored,
 * that one stands alone. Null when neither can.
 */
export function overallScore(
  match: MatchResult | null,
  screening: MatchCriterion | null,
): number | null {
  if (match && screening) {
    return Math.round(
      (match.score * (100 - SCREENING_SHARE) + screening.score * SCREENING_SHARE) / 100,
    );
  }
  return match?.score ?? screening?.score ?? null;
}
