import { ExternalLink, GraduationCap } from 'lucide-react';
import { cardClass, frostedAvatarStyle } from '@/lib/utils';
import { CandidateProgressColumn } from './CandidateProgressColumn';
import type { MatchResult } from '@/lib/hr/candidateMatch';
import type {
  CandidateEducation,
  CandidateExperience,
  RecruitmentCandidateDetail,
  RecruitmentStage,
  RecruitmentStageHistoryEntry,
} from '@/types/recruitment';

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-4 first:pt-0 last:pb-0">
      <h3 className="text-xs font-semibold text-(--module-btn-bg,var(--color-brand)) mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

const EMPTY = <p className="text-sm text-gray-400">Not provided</p>;

function educationDuration(e: CandidateEducation): string | null {
  if (!e.startYear && !e.endYear) return null;
  if (e.startYear && !e.endYear) return `${e.startYear} – Present`;
  if (!e.startYear) return String(e.endYear);
  return `${e.startYear} – ${e.endYear}`;
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function ExternalLinkRow({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-(--module-btn-bg,var(--color-brand)) hover:bg-[color-mix(in_oklch,var(--module-btn-bg,var(--color-brand))_8%,white)] hover:text-(--module-btn-bg,var(--color-brand))"
    >
      <span>{label}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" />
    </a>
  );
}

function monthYear(value: string): string {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
}

function experiencePeriod(e: CandidateExperience): string | null {
  if (!e.startDate) return e.endDate ? monthYear(e.endDate) : null;
  return `${monthYear(e.startDate)} – ${e.endDate ? monthYear(e.endDate) : 'Present'}`;
}

function ExperienceTimeline({ items }: { items: CandidateExperience[] }) {
  return (
    <ol className="relative ml-1.5 flex flex-col gap-6 border-l border-gray-200 pl-6">
      {items.map((e) => {
        const period = experiencePeriod(e);
        return (
          <li key={`${e.role}-${e.company}-${e.startDate}`} className="relative">
            <span className="absolute -left-[1.9rem] top-1.5 h-2.5 w-2.5 rounded-full bg-(--module-btn-bg,var(--color-brand)) ring-4 ring-white" />
            <p className="text-sm font-semibold text-gray-900">{e.role}</p>
            {e.company && <p className="text-xs text-gray-500">{e.company}</p>}
            {period && <p className="text-xs text-gray-400 mt-0.5">{period}</p>}
            {e.description && <p className="mt-2 text-sm text-gray-700">{e.description}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function salaryLabel(c: RecruitmentCandidateDetail): string | null {
  if (c.expectedSalary === null) return null;
  return `${c.expectedSalaryCurrency ?? ''} ${c.expectedSalary.toLocaleString('en-GB')}`.trim();
}

interface OverviewProps {
  candidate: RecruitmentCandidateDetail;
  stages: RecruitmentStage[];
  history: RecruitmentStageHistoryEntry[];
  match: MatchResult | null;
}

export function CandidateOverviewTab({ candidate, stages, history, match }: OverviewProps) {
  const links = [
    candidate.portfolioUrl && { label: 'Portfolio', url: candidate.portfolioUrl },
    candidate.githubUrl && { label: 'GitHub', url: candidate.githubUrl },
  ].filter((l): l is { label: string; url: string } => !!l);
  const salary = salaryLabel(candidate);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,27fr)_minmax(0,45fr)_minmax(0,28fr)] gap-6 items-start">
      <div className={cardClass('p-5 divide-y divide-gray-100')}>
        <SummarySection title="About Candidate">
          {candidate.professionalSummary ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {candidate.professionalSummary}
            </p>
          ) : (
            EMPTY
          )}
        </SummarySection>

        <SummarySection title="Skills">
          {candidate.skills.length > 0 ? <Chips items={candidate.skills} /> : EMPTY}
        </SummarySection>

        <SummarySection title="Education">
          {candidate.educationHistory.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {candidate.educationHistory.map((e) => {
                const duration = educationDuration(e);
                return (
                  <li key={`${e.school}-${e.startYear}`} className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 text-white"
                      style={frostedAvatarStyle('var(--module-btn-bg, var(--color-brand))')}
                    >
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{e.school}</p>
                      {e.level && <p className="text-xs text-gray-500">{e.level}</p>}
                      {duration && <p className="text-xs text-gray-400 mt-0.5">{duration}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            EMPTY
          )}
        </SummarySection>

        <SummarySection title="Languages">
          {candidate.languages.length > 0 ? <Chips items={candidate.languages} /> : EMPTY}
        </SummarySection>

        <SummarySection title="Links">
          {links.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {links.map((l) => (
                <ExternalLinkRow key={l.label} {...l} />
              ))}
            </div>
          ) : (
            EMPTY
          )}
        </SummarySection>

        <SummarySection title="Expected Salary">
          {salary ? <p className="text-sm font-semibold text-gray-900">{salary}</p> : EMPTY}
        </SummarySection>
      </div>

      <div className="flex flex-col gap-6 min-w-0">
        <div className={cardClass('p-5')}>
          <SummarySection title="Experience">
            {candidate.experienceHistory.length > 0 ? (
              <ExperienceTimeline items={candidate.experienceHistory} />
            ) : (
              EMPTY
            )}
          </SummarySection>
        </div>

        <div className={cardClass('p-5')}>
          <SummarySection title="Screening Questions">
            {candidate.answers.length > 0 ? (
              <ul className="flex flex-col divide-y divide-gray-100">
                {candidate.answers.map((a) => (
                  <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-xs font-semibold text-gray-500">{a.question}</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-gray-900">
                      {a.selectedOptions.length > 0 ? a.selectedOptions.join(', ') : a.answer}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              EMPTY
            )}
          </SummarySection>
        </div>
      </div>
      <CandidateProgressColumn
        candidate={candidate}
        stages={stages}
        history={history}
        match={match}
      />
    </div>
  );
}
