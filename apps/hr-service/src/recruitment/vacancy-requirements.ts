/** Education levels a vacancy can ask for, in ascending order. Codes are shared with the web form. */
export const RECRUITMENT_EDUCATION_LEVELS = [
  { code: 'NO_FORMAL_EDUCATION', label: 'No Formal Education' },
  { code: 'BASIC_EDUCATION', label: 'Basic Education (Primary)' },
  { code: 'JHS', label: 'Junior High School (JHS / BECE)' },
  { code: 'SHS', label: 'Senior High School (SHS / WASSCE)' },
  { code: 'TVET', label: 'Technical or Vocational Education (TVET)' },
  { code: 'CERTIFICATE', label: 'Certificate' },
  { code: 'DIPLOMA', label: 'Diploma' },
  { code: 'HND', label: 'Higher National Diploma (HND)' },
  { code: 'BACHELORS', label: "Bachelor's Degree" },
  { code: 'POSTGRADUATE_DIPLOMA', label: 'Postgraduate Diploma' },
  { code: 'MASTERS', label: "Master's Degree" },
  { code: 'DOCTORATE', label: 'Doctorate (PhD)' },
] as const;

export const RECRUITMENT_EDUCATION_LEVEL_CODES: string[] =
  RECRUITMENT_EDUCATION_LEVELS.map((level) => level.code);

export interface VacancyListRequirement {
  items: string[];
  required: boolean;
}

/**
 * Structured requirements stored in `RecruitmentVacancy.details`. A missing key means the
 * requirement is not part of the vacancy.
 */
export interface VacancyDetails {
  education?: { levels: string[]; required: boolean };
  experience?: {
    minYears?: number;
    maxYears?: number;
    required: boolean;
  };
  skills?: VacancyListRequirement;
  languages?: VacancyListRequirement;
  certificates?: VacancyListRequirement;
  /** What applicants are asked to provide with their application. */
  documents?: {
    resume: boolean;
    coverLetter: boolean;
    portfolio: boolean;
    github: boolean;
  };
}

function withRequired(text: string, required: boolean) {
  return required ? `${text} (required)` : text;
}

function experienceText(min?: number, max?: number) {
  if (min !== undefined && max !== undefined) return `${min} - ${max} years`;
  if (min !== undefined) return `${min}+ years`;
  if (max !== undefined) return `Up to ${max} years`;
  return '';
}

/** Plain-text rendering of the structured requirements, for the public posting's `requirements`. */
export function renderRequirementsText(details: VacancyDetails): string {
  const lines: string[] = [];

  if (details.education && details.education.levels.length > 0) {
    const labels = details.education.levels.map(
      (code) =>
        RECRUITMENT_EDUCATION_LEVELS.find((level) => level.code === code)
          ?.label ?? code,
    );
    lines.push(
      withRequired(
        `Education: ${labels.join(', ')}`,
        details.education.required,
      ),
    );
  }

  if (details.experience) {
    const text = experienceText(
      details.experience.minYears,
      details.experience.maxYears,
    );
    if (text) {
      lines.push(
        withRequired(`Experience: ${text}`, details.experience.required),
      );
    }
  }

  const lists: Array<[string, VacancyListRequirement | undefined]> = [
    ['Skills', details.skills],
    ['Languages', details.languages],
    ['Certificates', details.certificates],
  ];
  for (const [label, requirement] of lists) {
    if (requirement && requirement.items.length > 0) {
      lines.push(
        withRequired(
          `${label}: ${requirement.items.join(', ')}`,
          requirement.required,
        ),
      );
    }
  }

  return lines.join('\n');
}
