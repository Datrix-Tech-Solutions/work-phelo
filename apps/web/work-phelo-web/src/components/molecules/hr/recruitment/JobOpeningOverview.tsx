import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { formatDate } from '@/lib/formatters';
import type { EmploymentType } from '@/types/hr';
import type { WorkMode } from '@/types/scheduling';
import type { RecruitmentVacancy } from '@/types/recruitment';

const TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: 'Full Time',
  PART_TIME: 'Part Time',
  CONTRACT: 'Contract',
  INTERN: 'Intern',
};

const WORK_MODE_LABELS: Record<WorkMode, string> = {
  ONSITE: 'On-site',
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
};

function money(amount: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GHS',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency ?? ''} ${amount.toLocaleString('en-GB')}`.trim();
  }
}

function salaryLabel(v: RecruitmentVacancy): string {
  switch (v.salaryType) {
    case 'FIXED':
      return v.salaryAmount != null ? money(v.salaryAmount, v.salaryCurrency) : '—';
    case 'RANGE':
      return v.salaryMin != null && v.salaryMax != null
        ? `${money(v.salaryMin, v.salaryCurrency)} – ${money(v.salaryMax, v.salaryCurrency)}`
        : '—';
    case 'NEGOTIABLE':
      return 'Negotiable';
    default:
      return 'Not disclosed';
  }
}

/** Whole days from today to a YYYY-MM-DD date; negative once it has passed. */
function daysUntil(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - start.getTime()) / 86_400_000);
}

function closingNote(v: RecruitmentVacancy): string | undefined {
  if (!v.closingDate || v.status === 'CLOSED') return undefined;
  const days = daysUntil(v.closingDate);
  if (days < 0) return 'Past closing date';
  if (days === 0) return 'Closes today';
  return `${days} ${days === 1 ? 'day' : 'days'} left`;
}

export function JobOpeningOverview({ vacancy }: { vacancy: RecruitmentVacancy }) {
  const location = [vacancy.location, vacancy.city].filter(Boolean).join(', ');

  const note = closingNote(vacancy);

  return (
    <CollapsibleOverview>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField label="Applicants" value={vacancy.applicantCount} />
        <DetailField label="Positions" value={vacancy.vacancies} />
        <DetailField label="Department" value={vacancy.department?.name ?? '—'} />
        <DetailField label="Branch" value={vacancy.branch?.name ?? '—'} />
        <DetailField label="Location" value={location || '—'} />
        <DetailField
          label="Job Type"
          value={vacancy.jobType ? TYPE_LABELS[vacancy.jobType] : '—'}
        />
        <DetailField
          label="Work Mode"
          value={vacancy.workMode ? WORK_MODE_LABELS[vacancy.workMode] : '—'}
        />
        <DetailField label="Salary" value={salaryLabel(vacancy)} />
        <DetailField
          label="Closing Date"
          value={
            vacancy.closingDate
              ? `${formatDate(vacancy.closingDate)}${note ? ` · ${note}` : ''}`
              : '—'
          }
        />
        <DetailField label="Posted" value={formatDate(vacancy.createdAt)} />
        <DetailField label="Last Updated" value={formatDate(vacancy.updatedAt)} />
      </div>
    </CollapsibleOverview>
  );
}
