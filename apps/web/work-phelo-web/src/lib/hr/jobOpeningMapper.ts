import { plainTextToRichText, richTextToPlainText } from '@/lib/richText';
import type {
  JobOpeningFormValues,
  JobOpeningStatus,
  RecruitmentVacancy,
  RecruitmentVacancyPayload,
  VacancyDetails,
} from '@/types/recruitment';

const DEFAULT_CURRENCY = 'GHS';

/** An empty form field is sent as null so an edit clears the stored value. */
function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Rich text editor HTML to the plain text the API stores; an excluded field is cleared. */
function richOrNull(html: string, included: boolean): string | null {
  return included ? textOrNull(richTextToPlainText(html)) : null;
}

function wholeNumber(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : Number(trimmed);
}

/** Form values to the create / update body. Throws if a required enum value is still empty. */
export function toVacancyPayload(
  values: JobOpeningFormValues,
  status?: JobOpeningStatus,
): RecruitmentVacancyPayload {
  const { included } = values;

  const details: VacancyDetails = {
    documents: {
      // Resume details are read from the applicant's resume, so it is never requested.
      resume: false,
      coverLetter: values.requireCoverLetter,
      portfolio: values.requestPortfolio,
      github: values.requestGithub,
    },
  };
  if (included.education && values.educationLevels.length > 0) {
    details.education = { levels: values.educationLevels, required: values.educationRequired };
  }
  if (included.experience) {
    const minYears = wholeNumber(values.experienceMin);
    const maxYears = wholeNumber(values.experienceMax);
    if (minYears !== undefined || maxYears !== undefined) {
      details.experience = {
        ...(minYears !== undefined ? { minYears } : {}),
        ...(maxYears !== undefined ? { maxYears } : {}),
        required: values.experienceRequired,
      };
    }
  }
  if (included.skills && values.skills.length > 0) {
    details.skills = { items: values.skills, required: values.skillsRequired };
  }
  if (included.languages && values.languages.length > 0) {
    details.languages = { items: values.languages, required: values.languagesRequired };
  }
  if (included.certificates && values.certificates.length > 0) {
    details.certificates = { items: values.certificates, required: values.certificatesRequired };
  }

  const salary: Partial<RecruitmentVacancyPayload> = { salaryType: values.salaryType };
  if (values.salaryType === 'FIXED') {
    salary.salaryAmount = Number(values.salaryAmount);
    salary.salaryCurrency = values.salaryCurrency;
  } else if (values.salaryType === 'RANGE') {
    salary.salaryMin = Number(values.salaryMin);
    salary.salaryMax = Number(values.salaryMax);
    salary.salaryCurrency = values.salaryCurrency;
  }

  const questions = values.questions
    .filter((q) => q.question.trim())
    .map((q, index) => ({
      ...(q.existing ? { id: q.id } : {}),
      question: q.question.trim(),
      type: q.answerType,
      ...(q.options.length > 0 ? { options: q.options } : {}),
      required: q.required,
      sortOrder: index + 1,
    }));

  return {
    title: values.title.trim(),
    departmentId: values.departmentId || null,
    branchId: values.branchId || null,
    location: textOrNull(values.location),
    city: textOrNull(values.city),
    jobType: values.type as RecruitmentVacancyPayload['jobType'],
    ...(values.workMode ? { workMode: values.workMode } : {}),
    vacancies: Number(values.vacancies),
    closingDate: values.closingDate || null,
    description: richOrNull(values.description, included.description),
    responsibilities: richOrNull(values.responsibilities, included.responsibilities),
    perksAndBenefits: richOrNull(values.perksAndBenefits, included.perksAndBenefits),
    details,
    ...salary,
    salaryType: values.salaryType,
    ...(status ? { status } : {}),
    questions,
  };
}

/** A stored vacancy back into the wizard's values, for editing. */
export function toFormValues(vacancy: RecruitmentVacancy): JobOpeningFormValues {
  const details = vacancy.details ?? {};
  const documents = details.documents;
  const hasText = (value: string | null) => !!value?.trim();

  return {
    title: vacancy.title ?? '',
    departmentId: vacancy.departmentId ?? '',
    branchId: vacancy.branchId ?? '',
    type: vacancy.jobType ?? '',
    workMode: vacancy.workMode ?? '',
    vacancies: String(vacancy.vacancies),
    location: vacancy.location ?? '',
    city: vacancy.city ?? '',
    closingDate: vacancy.closingDate ?? '',
    description: plainTextToRichText(vacancy.description),
    responsibilities: plainTextToRichText(vacancy.responsibilities),
    perksAndBenefits: plainTextToRichText(vacancy.perksAndBenefits),
    educationLevels: details.education?.levels ?? [],
    educationRequired: details.education?.required ?? false,
    experienceMin:
      details.experience?.minYears !== undefined ? String(details.experience.minYears) : '',
    experienceMax:
      details.experience?.maxYears !== undefined ? String(details.experience.maxYears) : '',
    experienceRequired: details.experience?.required ?? false,
    skills: details.skills?.items ?? [],
    skillsRequired: details.skills?.required ?? false,
    languages: details.languages?.items ?? [],
    languagesRequired: details.languages?.required ?? false,
    certificates: details.certificates?.items ?? [],
    certificatesRequired: details.certificates?.required ?? false,
    included: {
      education: !!details.education,
      experience: !!details.experience,
      skills: !!details.skills,
      languages: !!details.languages,
      certificates: !!details.certificates,
      description: hasText(vacancy.description),
      responsibilities: hasText(vacancy.responsibilities),
      perksAndBenefits: hasText(vacancy.perksAndBenefits),
    },
    salaryType: vacancy.salaryType,
    salaryAmount: vacancy.salaryAmount !== null ? String(vacancy.salaryAmount) : '',
    salaryMin: vacancy.salaryMin !== null ? String(vacancy.salaryMin) : '',
    salaryMax: vacancy.salaryMax !== null ? String(vacancy.salaryMax) : '',
    salaryCurrency: vacancy.salaryCurrency ?? DEFAULT_CURRENCY,
    requireCoverLetter: documents?.coverLetter ?? false,
    requestPortfolio: documents?.portfolio ?? false,
    requestGithub: documents?.github ?? false,
    questions: [...vacancy.questions]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((q) => ({
        id: q.id,
        existing: true,
        question: q.question,
        answerType: q.type,
        options: q.type === 'YES_NO' ? [] : (q.options ?? []),
        required: q.required,
      })),
  };
}
