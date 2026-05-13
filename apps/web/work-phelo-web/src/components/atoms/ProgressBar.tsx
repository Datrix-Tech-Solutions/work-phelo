interface ProgressBarProps {
  value: number;
  showLabel?: boolean;
}

export function ProgressBar({ value, showLabel = true }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand rounded-full transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-bold text-gray-900 w-10 text-right">{clamped}%</span>
      )}
    </div>
  );
}
