import { ProgressBar } from '@/components/atoms/ProgressBar';

/** A name, "X of Y done", and a progress bar: one objective's progress, or the work with no objective. */
export function ProgressRow({
  name,
  done,
  total,
  percent,
}: {
  name: string;
  done: number;
  total: number;
  percent: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-400 shrink-0">
          {done} of {total} done
        </p>
      </div>
      <ProgressBar value={percent} />
    </div>
  );
}
