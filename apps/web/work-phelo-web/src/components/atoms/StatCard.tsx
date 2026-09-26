import { ReactNode } from 'react';
import { cardClass } from '@/lib/utils';

type DeltaTone = 'positive' | 'negative' | 'neutral';

const DELTA_TONE: Record<DeltaTone, string> = {
  positive: 'text-green-600',
  negative: 'text-red-600',
  neutral: 'text-gray-500',
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: string;
  /** Signed delta shown below (e.g. "+GHS 12,000.00"); coloured by `deltaTone`. */
  delta?: ReactNode;
  deltaTone?: DeltaTone;
  /** Muted note beside the delta, e.g. "88% of budget". */
  deltaNote?: string;
}

export function StatCard({
  label,
  value,
  sub,
  delta,
  deltaTone = 'neutral',
  deltaNote,
}: StatCardProps) {
  return (
    <div className={cardClass('flex flex-col gap-0 p-5', 'glass')}>
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
      {(delta != null || deltaNote) && (
        <div className="mt-1 flex items-center gap-2 text-xs font-semibold">
          {delta != null && <span className={DELTA_TONE[deltaTone]}>{delta}</span>}
          {deltaNote && <span className="font-medium text-gray-400">{deltaNote}</span>}
        </div>
      )}
    </div>
  );
}
