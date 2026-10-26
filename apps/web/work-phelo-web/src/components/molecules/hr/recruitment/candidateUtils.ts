import type { BadgeProps } from '@/components/atoms/Badge';
import type { RecruitmentCandidate } from '@/types/recruitment';

export function candidateFullName(c: Pick<RecruitmentCandidate, 'firstName' | 'lastName'>): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed candidate';
}

export function candidateLocation(c: Pick<RecruitmentCandidate, 'city' | 'country'>): string {
  return [c.city, c.country].filter(Boolean).join(', ') || '—';
}

export function experienceLabel(years: number | null): string {
  if (years === null) return '—';
  if (years === 0) return 'No experience';
  return `${years} ${years === 1 ? 'year' : 'years'}`;
}

export function stageVariant(name: string): BadgeProps['variant'] {
  switch (name.toLowerCase()) {
    case 'hired':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'offer':
      return 'warning';
    case 'screening':
    case 'interview':
      return 'info';
    default:
      return 'neutral';
  }
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
