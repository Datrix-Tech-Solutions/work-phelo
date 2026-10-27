import type { EmploymentType } from './hr';
import type { WorkMode } from './scheduling';

export type JobOpeningStatus = 'DRAFT' | 'OPEN' | 'CLOSED';

/** Answer type of a screening question, as in Google Forms. Mirrors the back-end enum. */
export type JobOpeningAnswerType =
  | 'SHORT_ANSWER'
  | 'PARAGRAPH'
  | 'YES_NO'
  | 'MULTIPLE_CHOICE'
  | 'CHECKBOXES'
  | 'DROPDOWN';

/** Structured requirements kept in `RecruitmentVacancy.details`; a missing key is not included. */
export interface VacancyDetails {
  education?: { levels: string[]; required: boolean };
  experience?: { minYears?: number; maxYears?: number; required: boolean };
  skills?: { items: string[]; required: boolean };
  languages?: { items: string[]; required: boolean };
  certificates?: { items: string[]; required: boolean };
  documents?: { resume: boolean; coverLetter: boolean; portfolio: boolean; github: boolean };
}

export interface RecruitmentVacancyQuestion {
  id: string;
  question: string;
  type: JobOpeningAnswerType;
  options: string[] | null;
  required: boolean;
  sortOrder: number;
}

/** A vacancy as returned by the recruitment API. */
export interface RecruitmentVacancy {
  id: string;
  title: string | null;
  departmentId: string | null;
  branchId: string | null;
  department: { id: string; name: string } | null;
  branch: { id: string; name: string } | null;
  location: string | null;
  city: string | null;
  jobType: EmploymentType | null;
  workMode: WorkMode | null;
  vacancies: number;
  /** YYYY-MM-DD */
  closingDate: string | null;
  description: string | null;
  responsibilities: string | null;
  perksAndBenefits: string | null;
  requirements: string | null;
  details: VacancyDetails | null;
  salaryType: JobOpeningSalaryType;
  salaryAmount: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  status: JobOpeningStatus;
  applicantCount: number;
  /** Minimum match score; applicants below it are rejected automatically. Null means none. */
  cutoffScore: number | null;
  questions: RecruitmentVacancyQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentVacancyPage {
  items: RecruitmentVacancy[];
  meta: { page: number; limit: number; total: number };
}

/** Body of POST / PATCH /hr/recruitment/vacancies. Text fields are null to clear them. */
export interface RecruitmentVacancyPayload {
  title: string;
  departmentId: string | null;
  branchId: string | null;
  location: string | null;
  city: string | null;
  jobType: EmploymentType;
  workMode?: WorkMode;
  vacancies: number;
  closingDate: string | null;
  description: string | null;
  responsibilities: string | null;
  perksAndBenefits: string | null;
  details: VacancyDetails;
  salaryType: JobOpeningSalaryType;
  salaryAmount?: number;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  status?: JobOpeningStatus;
  questions: Array<{
    id?: string;
    question: string;
    type: JobOpeningAnswerType;
    options?: string[];
    required: boolean;
    sortOrder: number;
  }>;
}

/** Fields the user can leave off the job opening. */
export type JobOpeningIncludableField =
  | 'education'
  | 'experience'
  | 'skills'
  | 'languages'
  | 'certificates'
  | 'description'
  | 'responsibilities'
  | 'perksAndBenefits';

export type JobOpeningSalaryType = 'FIXED' | 'RANGE' | 'NEGOTIABLE' | 'NON_DISCLOSED';

export interface JobOpeningQuestionRow {
  id: string;
  /** True when the question was loaded from the server, so saving updates it in place. */
  existing?: boolean;
  question: string;
  answerType: JobOpeningAnswerType;
  /** Choices for MULTIPLE_CHOICE, CHECKBOXES and DROPDOWN; unused for the other types. */
  options: string[];
  required: boolean;
}

/** Values collected by the create job opening wizard. */
export interface JobOpeningFormValues {
  title: string;
  departmentId: string;
  branchId: string;
  type: EmploymentType | '';
  workMode: WorkMode | '';
  /** Kept as a string while editing; validated as a whole number >= 1. */
  vacancies: string;
  location: string;
  city: string;
  /** YYYY-MM-DD, empty when the opening has no closing date. */
  closingDate: string;
  description: string;
  responsibilities: string;
  perksAndBenefits: string;
  /** Accepted education levels — values from EDUCATION_LEVEL_OPTIONS. */
  educationLevels: string[];
  /** Whether applicants must meet the education requirement (as opposed to preferred). */
  educationRequired: boolean;
  /** Whole years; empty when not specified. */
  experienceMin: string;
  experienceMax: string;
  /** Whether applicants must meet the experience requirement (as opposed to preferred). */
  experienceRequired: boolean;
  skills: string[];
  /** Whether applicants must have the listed skills (as opposed to preferred). */
  skillsRequired: boolean;
  languages: string[];
  /** Whether applicants must speak the listed languages (as opposed to preferred). */
  languagesRequired: boolean;
  certificates: string[];
  /** Whether applicants must hold the listed certificates (as opposed to preferred). */
  certificatesRequired: boolean;
  /** Which fields are included on the job opening. */
  included: Record<JobOpeningIncludableField, boolean>;
  salaryType: JobOpeningSalaryType;
  /** Used when salaryType is FIXED. */
  salaryAmount: string;
  /** Used when salaryType is RANGE. */
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  /** What applicants are asked to provide. */
  requireCoverLetter: boolean;
  requestPortfolio: boolean;
  requestGithub: boolean;
  questions: JobOpeningQuestionRow[];
}

export interface RecruitmentStage {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isDefault: boolean;
}

/** Allowlisted submitted-application summary. Private fields are only on detail. */
export interface RecruitmentCandidate {
  id: string;
  vacancyId: string;
  currentStageId: string | null;
  firstName: string | null;
  lastName: string | null;
  status: 'SUBMITTED';
  /** 0–100, the current score: the application's match, blended with screening once reviewed. */
  matchScore: number | null;
  appliedAt: string;
  submittedAt: string | null;
  vacancy: { id: string; title: string | null };
  currentStage: Pick<RecruitmentStage, 'id' | 'name' | 'sortOrder' | 'isDefault'> | null;
}

export interface RecruitmentCandidatePage {
  items: RecruitmentCandidate[];
  meta: { page: number; limit: number; total: number };
}

export interface CandidateExperience {
  role: string;
  company: string | null;
  /** YYYY-MM, null when unknown. */
  startDate: string | null;
  /** YYYY-MM; null means the candidate still works there. */
  endDate: string | null;
  description: string | null;
}

export interface CandidateEducation {
  school: string;
  level: string | null;
  startYear: number | null;
  /** Null while still studying. */
  endYear: number | null;
}

/** A reviewer's call on one screening answer. A question with no entry is still pending. */
export type ScreeningDecision = 'ACCEPTED' | 'DECLINED';
export type ScreeningDecisions = Record<string, ScreeningDecision>;

export interface RecruitmentCandidateAnswer {
  id: string;
  questionId: string;
  /** The reviewer's call on this answer; null until it has been reviewed. */
  screeningDecision: ScreeningDecision | null;
  question: string;
  answer: string;
  selectedOptions: string[];
}

/** A single candidate with everything the application collected. */
export interface RecruitmentCandidateDetail extends RecruitmentCandidate {
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  yearsOfExperience: number | null;
  currentJobTitle: string | null;
  currentEmployer: string | null;
  highestEducationLevel: string | null;
  resumeUrl: string | null;
  currentStage: RecruitmentStage | null;
  professionalSummary: string | null;
  skills: string[];
  languages: string[];
  certificates: string[];
  /** School entries for the overview; derived from `education` when the API has no structure. */
  educationHistory: CandidateEducation[];
  /** Work history, newest first; derived from the current role when the API has no structure. */
  experienceHistory: CandidateExperience[];
  education: string | null;
  expectedSalary: number | null;
  expectedSalaryCurrency: string | null;
  noticePeriod: string | null;
  resumeFileName: string | null;
  coverLetterUrl: string | null;
  coverLetterFileName: string | null;
  portfolioUrl: string | null;
  githubUrl: string | null;
  answers: RecruitmentCandidateAnswer[];
}

export interface RecruitmentStageHistoryEntry {
  id: string;
  previousStage: { id: string; name: string } | null;
  newStage: { id: string; name: string };
  changedByEmployee: { id: string; firstName: string; lastName: string } | null;
  note: string | null;
  changedAt: string;
}

export type InterviewMode = 'IN_PERSON' | 'VIDEO' | 'PHONE';
export type InterviewStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export interface CandidateInterview {
  id: string;
  title: string;
  mode: InterviewMode;
  status: InterviewStatus;
  /** ISO date-time of the start. */
  scheduledAt: string;
  durationMinutes: number;
  location: string | null;
  interviewers: string[];
  feedback: string | null;
  /** Video: the meeting platform and join link. Phone: the number to call. */
  platform?: string | null;
  meetingLink?: string | null;
  phone?: string | null;
  /** Instructions or context the recruiter left for the interview. */
  notes?: string | null;
}

/** What the schedule interview form collects. */
export interface ScheduleInterviewInput {
  candidateId: string;
  mode: InterviewMode;
  platform: string | null;
  meetingLink: string | null;
  phone: string | null;
  location: string | null;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm, 24-hour */
  startTime: string;
  durationMinutes: number;
  notes: string | null;
}

/** Result of setting a cut-off: how many applicants moved (or would move on a dry run). */
export interface CutoffResult {
  cutoffScore: number | null;
  rejected: number;
  restored: number;
  applied: boolean;
}
