'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import { Icons } from '@/components/atoms/icons';
import { StepProgressBar } from '@/components/atoms/StepProgressBar';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { Toggle } from '@/components/atoms/Toggle';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { TagInput } from '@/components/atoms/TagInput';
import { RichTextEditor } from '@/components/molecules/shared/RichTextEditor';
import { ScreeningQuestionCard } from '@/components/molecules/hr/recruitment/ScreeningQuestionCard';
import { IncludeToggleField } from '@/components/molecules/hr/recruitment/IncludeToggleField';
import { JobOpeningFormSection } from '@/components/molecules/hr/recruitment/JobOpeningFormSection';
import { useToast } from '@/hooks/useToast';
import { useDepartmentOptions } from '@/hooks/hr/useDepartments';
import { useBranches } from '@/hooks/hr/useBranches';
import { formatDate } from '@/lib/formatters';
import { pagePx } from '@/lib/layout';
import { richTextToPlainText } from '@/lib/richText';
import { inputClass } from '@/lib/utils';
import type { EmploymentType } from '@/types/hr';
import type { WorkMode } from '@/types/scheduling';
import type {
  JobOpeningFormValues,
  JobOpeningAnswerType,
  JobOpeningQuestionRow,
  JobOpeningStatus,
  JobOpeningIncludableField,
  JobOpeningSalaryType,
} from '@/types/recruitment';

const STEPS = [
  'Job Information',
  'Job Description',
  'Requirements',
  'Application Settings',
  'Preview',
];

const TYPE_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Intern' },
];

type DocumentRequestKey = 'requireCoverLetter' | 'requestPortfolio' | 'requestGithub';

const DOCUMENT_REQUESTS: { key: DocumentRequestKey; label: string; hint: string }[] = [
  {
    key: 'requireCoverLetter',
    label: 'Cover letter',
    hint: 'Ask applicants for a cover letter.',
  },
  {
    key: 'requestPortfolio',
    label: 'Portfolio link',
    hint: 'Ask applicants for a portfolio link.',
  },
  { key: 'requestGithub', label: 'GitHub link', hint: 'Ask applicants for a GitHub profile link.' },
];

const WORK_MODE_OPTIONS: { value: WorkMode; label: string }[] = [
  { value: 'ONSITE', label: 'On-site' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'HYBRID', label: 'Hybrid' },
];

const SALARY_TYPE_OPTIONS: { value: JobOpeningSalaryType; label: string }[] = [
  { value: 'FIXED', label: 'Fixed' },
  { value: 'RANGE', label: 'Range' },
  { value: 'NEGOTIABLE', label: 'Negotiable' },
  { value: 'NON_DISCLOSED', label: 'Non-disclosed' },
];

const EDUCATION_LEVEL_OPTIONS: { value: string; label: string }[] = [
  { value: 'NO_FORMAL_EDUCATION', label: 'No Formal Education' },
  { value: 'BASIC_EDUCATION', label: 'Basic Education (Primary)' },
  { value: 'JHS', label: 'Junior High School (JHS / BECE)' },
  { value: 'SHS', label: 'Senior High School (SHS / WASSCE)' },
  { value: 'TVET', label: 'Technical or Vocational Education (TVET)' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'HND', label: 'Higher National Diploma (HND)' },
  { value: 'BACHELORS', label: "Bachelor's Degree" },
  { value: 'POSTGRADUATE_DIPLOMA', label: 'Postgraduate Diploma' },
  { value: 'MASTERS', label: "Master's Degree" },
  { value: 'DOCTORATE', label: 'Doctorate (PhD)' },
];

const ANSWER_TYPE_OPTIONS: { value: JobOpeningAnswerType; label: string }[] = [
  { value: 'YES_NO', label: 'Yes / No' },
  { value: 'SHORT_ANSWER', label: 'Short answer' },
  { value: 'PARAGRAPH', label: 'Paragraph' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple choice' },
  { value: 'CHECKBOXES', label: 'Checkboxes' },
  { value: 'DROPDOWN', label: 'Dropdown' },
];

/** Answer types offered in the dropdown for now; the rest stay supported but are hidden. */
const ENABLED_ANSWER_TYPES: JobOpeningAnswerType[] = ['YES_NO', 'SHORT_ANSWER'];

const CHOICE_ANSWER_TYPES: JobOpeningAnswerType[] = ['MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN'];

function emptyQuestion(): JobOpeningQuestionRow {
  return {
    id: crypto.randomUUID(),
    question: '',
    answerType: 'SHORT_ANSWER',
    options: [],
    required: false,
  };
}

const EMPTY_VALUES: JobOpeningFormValues = {
  title: '',
  departmentId: '',
  branchId: '',
  type: '',
  workMode: '',
  vacancies: '1',
  location: '',
  city: '',
  closingDate: '',
  description: '',
  responsibilities: '',
  perksAndBenefits: '',
  educationLevels: [],
  educationRequired: false,
  experienceMin: '',
  experienceMax: '',
  experienceRequired: false,
  skills: [],
  skillsRequired: false,
  languages: [],
  languagesRequired: false,
  certificates: [],
  certificatesRequired: false,
  included: {
    education: true,
    experience: true,
    skills: true,
    languages: true,
    certificates: true,
    description: true,
    responsibilities: true,
    perksAndBenefits: true,
  },
  salaryType: 'FIXED',
  salaryAmount: '',
  salaryMin: '',
  salaryMax: '',
  salaryCurrency: 'GHS',
  requireCoverLetter: false,
  requestPortfolio: false,
  requestGithub: false,
  questions: [],
};

type Errors = Partial<Record<keyof JobOpeningFormValues, string>>;

interface JobOpeningWizardProps {
  tenantSlug: string;
  initialValues?: JobOpeningFormValues;
  /** Status of the job opening being edited; omit when creating. */
  status?: JobOpeningStatus;
  isSubmitting?: boolean;
  /** `status` is only passed when saving as a draft or publishing; undefined keeps the status. */
  onSubmit: (values: JobOpeningFormValues, status?: JobOpeningStatus) => void;
  onCancel: () => void;
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-gray-400">{label}</span>
      <span className="text-sm text-gray-900 whitespace-pre-line">{value || '—'}</span>
    </div>
  );
}

/** Shows the plain text that will actually be saved for a rich text field. */
function RichPreviewRow({ label, html }: { label: string; html: string }) {
  return <PreviewRow label={label} value={richTextToPlainText(html)} />;
}

export function JobOpeningWizard({
  tenantSlug,
  initialValues,
  status,
  isSubmitting,
  onSubmit,
  onCancel,
}: JobOpeningWizardProps) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<JobOpeningFormValues>(initialValues ?? EMPTY_VALUES);
  const [errors, setErrors] = useState<Errors>({});
  const [questionErrors, setQuestionErrors] = useState<Record<string, string>>({});

  const { data: departments = [] } = useDepartmentOptions();
  const { data: branches = [] } = useBranches();

  const departmentOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: d.name })),
    [departments],
  );
  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: b.id, label: b.name })),
    [branches],
  );

  function set<K extends keyof JobOpeningFormValues>(key: K, val: JobOpeningFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  function setIncluded(field: JobOpeningIncludableField, included: boolean) {
    setValues((v) => ({ ...v, included: { ...v.included, [field]: included } }));
  }

  function validate(): boolean {
    const next: Errors = {};
    if (step === 0) {
      if (!values.title.trim()) next.title = 'Job title is required.';
      if (!values.departmentId) next.departmentId = 'Department is required.';
      if (!values.type) next.type = 'Employment type is required.';
      const vacancies = Number(values.vacancies);
      if (!Number.isInteger(vacancies) || vacancies < 1)
        next.vacancies = 'Enter at least 1 vacancy.';
      if (values.salaryType === 'FIXED' && !(parseFloat(values.salaryAmount) > 0))
        next.salaryAmount = 'Enter the salary amount.';
      if (values.salaryType === 'RANGE') {
        const min = parseFloat(values.salaryMin);
        const max = parseFloat(values.salaryMax);
        if (!(min > 0)) next.salaryMin = 'Enter the minimum salary.';
        if (!(max > 0)) next.salaryMax = 'Enter the maximum salary.';
        else if (min > 0 && max < min)
          next.salaryMax = 'Maximum salary cannot be less than the minimum.';
      }
    }
    if (step === 2 && values.included.experience) {
      const min = values.experienceMin.trim();
      const max = values.experienceMax.trim();
      const isYears = (v: string) => Number.isInteger(Number(v)) && Number(v) >= 0;
      if (min && !isYears(min)) next.experienceMin = 'Enter whole years, 0 or more.';
      if (max && !isYears(max)) next.experienceMax = 'Enter whole years, 0 or more.';
      if (!next.experienceMin && !next.experienceMax && min && max && Number(max) < Number(min))
        next.experienceMax = 'Maximum cannot be less than the minimum.';
    }
    const nextQuestionErrors: Record<string, string> = {};
    if (step === 2) {
      values.questions.forEach((q) => {
        if (
          q.question.trim() &&
          CHOICE_ANSWER_TYPES.includes(q.answerType) &&
          q.options.length === 0
        )
          nextQuestionErrors[q.id] = 'Add at least one option.';
      });
    }
    setErrors(next);
    setQuestionErrors(nextQuestionErrors);
    return Object.keys(next).length === 0 && Object.keys(nextQuestionErrors).length === 0;
  }

  function handleNext() {
    if (!validate()) return;
    setStep((s) => s + 1);
  }

  /** Publishing needs more than a draft does; the API enforces the same four fields. */
  function missingForPublish() {
    const missing: string[] = [];
    if (!values.title.trim()) missing.push('job title');
    if (!values.type) missing.push('employment type');
    if (!values.location.trim()) missing.push('location');
    if (!values.included.description || !richTextToPlainText(values.description)) {
      missing.push('job summary');
    }
    return missing;
  }

  function handleSubmit(nextStatus?: JobOpeningStatus) {
    if (!validate()) return;
    if (nextStatus === 'OPEN') {
      const missing = missingForPublish();
      if (missing.length > 0) {
        toast.error(`Add the ${missing.join(', ')} before publishing.`);
        return;
      }
    }
    onSubmit(values, nextStatus);
  }

  function handleBack() {
    setErrors({});
    setQuestionErrors({});
    setStep((s) => s - 1);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleQuestionDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = values.questions.findIndex((q) => q.id === active.id);
    const to = values.questions.findIndex((q) => q.id === over.id);
    if (from === -1 || to === -1) return;
    set('questions', arrayMove(values.questions, from, to));
  }

  function updateQuestion(id: string, patch: Partial<JobOpeningQuestionRow>) {
    set(
      'questions',
      values.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    );
  }

  const labelOf = (options: { value: string; label: string }[], id: string) =>
    options.find((o) => o.value === id)?.label ?? '';

  const experienceText = (() => {
    const min = values.experienceMin.trim();
    const max = values.experienceMax.trim();
    if (min && max) return `${min} – ${max} years`;
    if (min) return `${min}+ years`;
    if (max) return `Up to ${max} years`;
    return '';
  })();

  const salaryText = (() => {
    const c = values.salaryCurrency;
    if (values.salaryType === 'FIXED')
      return values.salaryAmount ? `${c} ${values.salaryAmount}` : '';
    if (values.salaryType === 'RANGE')
      return `${c} ${values.salaryMin || '—'} – ${values.salaryMax || '—'}`;
    return SALARY_TYPE_OPTIONS.find((o) => o.value === values.salaryType)?.label ?? '';
  })();

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      {/* Pinned header */}
      <div className={`shrink-0 ${pagePx} pt-4 pb-4`}>
        <div className="mx-auto w-full max-w-4xl flex flex-col gap-4">
          <nav className="flex items-center gap-2 text-sm text-gray-400">
            <Link
              href={`/${tenantSlug}/hr/recruitment/job-openings`}
              className="hover:text-gray-700 transition-colors"
            >
              Job Openings
            </Link>
            <Icons.ChevronRight className="w-4 h-4" />
            <span className="text-gray-700 font-medium">
              {values.title.trim() || 'New Job Opening'}
            </span>
          </nav>
          <StepProgressBar steps={STEPS} currentStep={step} card />
        </div>
      </div>

      {/* Scrollable content — the form is centred, with each section header above its fields */}
      <div className={`flex-1 min-h-0 overflow-y-auto ${pagePx} pt-4 pb-24`}>
        <div className="mx-auto w-full max-w-4xl flex flex-col gap-4">
          {step === 0 && (
            <>
              <JobOpeningFormSection title="Job Information">
                <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                  <label className="text-sm font-bold text-gray-900">Job Title</label>
                  <input
                    type="text"
                    placeholder="eg; Senior Accountant"
                    value={values.title}
                    onChange={(e) => set('title', e.target.value)}
                    className={inputClass(errors.title)}
                  />
                  {errors.title && <p className="text-xs text-red-500">{errors.title}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SearchSelect
                    label="Branch"
                    placeholder="Select branch"
                    options={branchOptions}
                    value={values.branchId}
                    onChange={(v) => set('branchId', v)}
                  />
                  <SearchSelect
                    label="Department"
                    placeholder="Select department"
                    options={departmentOptions}
                    value={values.departmentId}
                    onChange={(v) => set('departmentId', v)}
                    error={errors.departmentId}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <SearchSelect
                    label="Employment Type"
                    placeholder="Select type"
                    options={TYPE_OPTIONS}
                    value={values.type}
                    onChange={(v) => set('type', v as EmploymentType)}
                    error={errors.type}
                  />
                  <SearchSelect
                    label="Work Mode"
                    placeholder="Select work mode"
                    options={WORK_MODE_OPTIONS}
                    value={values.workMode}
                    onChange={(v) => set('workMode', v as WorkMode)}
                  />
                  <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                    <label className="text-sm font-bold text-gray-900">Number of Vacancies</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={values.vacancies}
                      onChange={(e) => set('vacancies', e.target.value)}
                      className={inputClass(errors.vacancies)}
                    />
                    {errors.vacancies && <p className="text-xs text-red-500">{errors.vacancies}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                    <label className="text-sm font-bold text-gray-900">Location</label>
                    <input
                      type="text"
                      placeholder="eg; Airport Residential Area"
                      value={values.location}
                      onChange={(e) => set('location', e.target.value)}
                      className={inputClass()}
                    />
                  </div>
                  <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                    <label className="text-sm font-bold text-gray-900">City</label>
                    <input
                      type="text"
                      placeholder="eg; Accra"
                      value={values.city}
                      onChange={(e) => set('city', e.target.value)}
                      className={inputClass()}
                    />
                  </div>
                </div>
              </JobOpeningFormSection>

              <JobOpeningFormSection title="Salary Information">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  {SALARY_TYPE_OPTIONS.map(({ value, label }) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2 text-sm text-gray-900"
                    >
                      <input
                        type="radio"
                        name="job-opening-salary-type"
                        checked={values.salaryType === value}
                        onChange={() => set('salaryType', value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {values.salaryType === 'FIXED' && (
                  <CurrencyInput
                    label="Amount"
                    value={values.salaryAmount}
                    currency={values.salaryCurrency}
                    onValueChange={(v) => set('salaryAmount', v)}
                    onCurrencyChange={(c) => set('salaryCurrency', c)}
                    error={errors.salaryAmount}
                  />
                )}
                {values.salaryType === 'RANGE' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <CurrencyInput
                      label="Minimum"
                      value={values.salaryMin}
                      currency={values.salaryCurrency}
                      onValueChange={(v) => set('salaryMin', v)}
                      onCurrencyChange={(c) => set('salaryCurrency', c)}
                      error={errors.salaryMin}
                    />
                    <CurrencyInput
                      label="Maximum"
                      value={values.salaryMax}
                      currency={values.salaryCurrency}
                      onValueChange={(v) => set('salaryMax', v)}
                      onCurrencyChange={(c) => set('salaryCurrency', c)}
                      error={errors.salaryMax}
                    />
                  </div>
                )}
              </JobOpeningFormSection>
            </>
          )}

          {step === 1 && (
            <JobOpeningFormSection title="Job Description">
              <IncludeToggleField
                label="Job Summary"
                included={values.included.description}
                onIncludedChange={(v) => setIncluded('description', v)}
              >
                <RichTextEditor
                  placeholder="A short overview of the role"
                  value={values.description}
                  onChange={(v) => set('description', v)}
                />
              </IncludeToggleField>
              <IncludeToggleField
                label="Key Responsibilities"
                included={values.included.responsibilities}
                onIncludedChange={(v) => setIncluded('responsibilities', v)}
              >
                <RichTextEditor
                  placeholder="What will the person be doing?"
                  value={values.responsibilities}
                  onChange={(v) => set('responsibilities', v)}
                />
              </IncludeToggleField>
              <IncludeToggleField
                label="Perks and Benefits"
                included={values.included.perksAndBenefits}
                onIncludedChange={(v) => setIncluded('perksAndBenefits', v)}
              >
                <RichTextEditor
                  placeholder="eg; Health insurance, transport allowance, annual bonus"
                  value={values.perksAndBenefits}
                  onChange={(v) => set('perksAndBenefits', v)}
                />
              </IncludeToggleField>
            </JobOpeningFormSection>
          )}

          {step === 2 && (
            <>
              <JobOpeningFormSection title="Requirements">
                <IncludeToggleField
                  label="Education"
                  included={values.included.education}
                  onIncludedChange={(v) => setIncluded('education', v)}
                  required={values.educationRequired}
                  onRequiredChange={(v) => set('educationRequired', v)}
                >
                  <MultiSelect
                    placeholder="Select education levels"
                    options={EDUCATION_LEVEL_OPTIONS}
                    value={values.educationLevels}
                    onChange={(v) => set('educationLevels', v)}
                  />
                </IncludeToggleField>
                <IncludeToggleField
                  label="Experience"
                  included={values.included.experience}
                  onIncludedChange={(v) => setIncluded('experience', v)}
                  required={values.experienceRequired}
                  onRequiredChange={(v) => set('experienceRequired', v)}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                      <label className="text-sm font-bold text-gray-900">
                        Minimum Years of Experience
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        placeholder="eg; 2"
                        value={values.experienceMin}
                        onChange={(e) => set('experienceMin', e.target.value)}
                        className={inputClass(errors.experienceMin)}
                      />
                      {errors.experienceMin && (
                        <p className="text-xs text-red-500">{errors.experienceMin}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                      <label className="text-sm font-bold text-gray-900">
                        Maximum Years of Experience
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        placeholder="eg; 5"
                        value={values.experienceMax}
                        onChange={(e) => set('experienceMax', e.target.value)}
                        className={inputClass(errors.experienceMax)}
                      />
                      {errors.experienceMax && (
                        <p className="text-xs text-red-500">{errors.experienceMax}</p>
                      )}
                    </div>
                  </div>
                </IncludeToggleField>

                <IncludeToggleField
                  label="Skills"
                  included={values.included.skills}
                  onIncludedChange={(v) => setIncluded('skills', v)}
                  required={values.skillsRequired}
                  onRequiredChange={(v) => set('skillsRequired', v)}
                >
                  <TagInput
                    placeholder="Type a skill and press Enter"
                    value={values.skills}
                    onChange={(v) => set('skills', v)}
                  />
                </IncludeToggleField>

                <IncludeToggleField
                  label="Languages"
                  included={values.included.languages}
                  onIncludedChange={(v) => setIncluded('languages', v)}
                  required={values.languagesRequired}
                  onRequiredChange={(v) => set('languagesRequired', v)}
                >
                  <TagInput
                    placeholder="Type a language and press Enter"
                    value={values.languages}
                    onChange={(v) => set('languages', v)}
                  />
                </IncludeToggleField>

                <IncludeToggleField
                  label="Certificates"
                  included={values.included.certificates}
                  onIncludedChange={(v) => setIncluded('certificates', v)}
                  required={values.certificatesRequired}
                  onRequiredChange={(v) => set('certificatesRequired', v)}
                >
                  <TagInput
                    placeholder="Type a certificate and press Enter"
                    value={values.certificates}
                    onChange={(v) => set('certificates', v)}
                  />
                </IncludeToggleField>
              </JobOpeningFormSection>
              <JobOpeningFormSection
                title="Screening Questions"
                description="Optional. Applicants answer these when they apply."
              >
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleQuestionDragEnd}
                >
                  <SortableContext
                    items={values.questions.map((q) => q.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {values.questions.map((q, index) => (
                      <ScreeningQuestionCard
                        key={q.id}
                        question={q}
                        index={index}
                        answerTypeOptions={ANSWER_TYPE_OPTIONS.filter(
                          (o) => ENABLED_ANSWER_TYPES.includes(o.value) || o.value === q.answerType,
                        )}
                        hasOptions={CHOICE_ANSWER_TYPES.includes(q.answerType)}
                        error={questionErrors[q.id]}
                        onChange={(patch) => updateQuestion(q.id, patch)}
                        onRemove={() =>
                          set(
                            'questions',
                            values.questions.filter((x) => x.id !== q.id),
                          )
                        }
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={() => set('questions', [...values.questions, emptyQuestion()])}
                  >
                    Add Question
                  </Button>
                </div>
              </JobOpeningFormSection>
            </>
          )}

          {step === 3 && (
            <>
              <JobOpeningFormSection title="Closing Date">
                <DatePicker
                  label="Applications Close On"
                  value={values.closingDate}
                  onChange={(v) => set('closingDate', v)}
                  disablePast
                />
              </JobOpeningFormSection>
              <JobOpeningFormSection
                title="Documents"
                description="Choose what applicants are asked to provide when they apply."
              >
                {DOCUMENT_REQUESTS.map(({ key, label, hint }) => (
                  <div key={key} className="flex items-center justify-between gap-4 py-1">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-900">{label}</span>
                      <span className="text-xs text-gray-500">{hint}</span>
                    </div>
                    <Toggle enabled={values[key]} onChange={(v) => set(key, v)} />
                  </div>
                ))}
              </JobOpeningFormSection>
            </>
          )}

          {step === 4 && (
            <>
              <JobOpeningFormSection title="Job Information">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                  <PreviewRow label="Job Title" value={values.title} />
                  <PreviewRow label="Branch" value={labelOf(branchOptions, values.branchId)} />
                  <PreviewRow
                    label="Department"
                    value={labelOf(departmentOptions, values.departmentId)}
                  />
                  <PreviewRow label="Employment Type" value={labelOf(TYPE_OPTIONS, values.type)} />
                  <PreviewRow
                    label="Work Mode"
                    value={labelOf(WORK_MODE_OPTIONS, values.workMode)}
                  />
                  <PreviewRow label="Number of Vacancies" value={values.vacancies} />
                  <PreviewRow label="Location" value={values.location} />
                  <PreviewRow label="City" value={values.city} />
                  <PreviewRow label="Salary" value={salaryText} />
                </div>
              </JobOpeningFormSection>
              <JobOpeningFormSection title="Job Description">
                {values.included.description ? (
                  <RichPreviewRow label="Job Summary" html={values.description} />
                ) : (
                  <PreviewRow label="Job Summary" value="Not included" />
                )}
                {values.included.responsibilities ? (
                  <RichPreviewRow label="Key Responsibilities" html={values.responsibilities} />
                ) : (
                  <PreviewRow label="Key Responsibilities" value="Not included" />
                )}
                {values.included.perksAndBenefits ? (
                  <RichPreviewRow label="Perks and Benefits" html={values.perksAndBenefits} />
                ) : (
                  <PreviewRow label="Perks and Benefits" value="Not included" />
                )}
              </JobOpeningFormSection>
              <JobOpeningFormSection title="Requirements">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                  <PreviewRow
                    label={values.educationRequired ? 'Education (required)' : 'Education'}
                    value={
                      values.included.education
                        ? values.educationLevels
                            .map((v) => labelOf(EDUCATION_LEVEL_OPTIONS, v))
                            .join(', ')
                        : 'Not included'
                    }
                  />
                  <PreviewRow
                    label={values.experienceRequired ? 'Experience (required)' : 'Experience'}
                    value={values.included.experience ? experienceText : 'Not included'}
                  />
                  <PreviewRow
                    label={values.skillsRequired ? 'Skills (required)' : 'Skills'}
                    value={values.included.skills ? values.skills.join(', ') : 'Not included'}
                  />
                  <PreviewRow
                    label={values.languagesRequired ? 'Languages (required)' : 'Languages'}
                    value={values.included.languages ? values.languages.join(', ') : 'Not included'}
                  />
                  <PreviewRow
                    label={values.certificatesRequired ? 'Certificates (required)' : 'Certificates'}
                    value={
                      values.included.certificates ? values.certificates.join(', ') : 'Not included'
                    }
                  />
                </div>
              </JobOpeningFormSection>
              <JobOpeningFormSection title="Screening Questions">
                {values.questions.filter((q) => q.question.trim()).length === 0 ? (
                  <PreviewRow label="Screening Questions" value="" />
                ) : (
                  values.questions
                    .filter((q) => q.question.trim())
                    .map((q, index) => (
                      <PreviewRow
                        key={q.id}
                        label={`Question ${index + 1}${q.required ? ' (required)' : ''}`}
                        value={[
                          q.question,
                          labelOf(ANSWER_TYPE_OPTIONS, q.answerType),
                          ...(CHOICE_ANSWER_TYPES.includes(q.answerType)
                            ? [q.options.join(', ')]
                            : []),
                        ].join('\n')}
                      />
                    ))
                )}
              </JobOpeningFormSection>
              <JobOpeningFormSection title="Application Settings">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                  <PreviewRow
                    label="Closing Date"
                    value={values.closingDate ? formatDate(values.closingDate) : ''}
                  />
                  {DOCUMENT_REQUESTS.map(({ key, label }) => (
                    <PreviewRow key={key} label={label} value={values[key] ? 'Yes' : 'No'} />
                  ))}
                </div>
              </JobOpeningFormSection>
            </>
          )}
        </div>
      </div>

      {/* Glass footer */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-10 backdrop-blur-xs bg-white/10 border-t border-white/50 ${pagePx} pt-4 pb-6 sm:pb-8`}
      >
        <div className="mx-auto w-full max-w-4xl flex items-center justify-end gap-3">
          {step === 0 ? (
            <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          ) : (
            <Button
              variant="outline"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={handleBack}
              disabled={isSubmitting}
            >
              Previous
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button icon={<ArrowRight className="w-4 h-4" />} onClick={handleNext}>
              Next
            </Button>
          ) : !status || status === 'DRAFT' ? (
            <>
              <Button
                variant="secondary"
                onClick={() => handleSubmit('DRAFT')}
                disabled={isSubmitting}
              >
                Save as Draft
              </Button>
              <Button onClick={() => handleSubmit('OPEN')} isLoading={isSubmitting}>
                Publish
              </Button>
            </>
          ) : (
            <Button onClick={() => handleSubmit()} isLoading={isSubmitting}>
              Save Changes
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
