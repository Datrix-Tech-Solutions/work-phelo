import { cn } from '@/lib/utils';

interface LoadingMarkProps {
  icon: React.ReactNode;
  className?: string;
}

// Centered mark for full-screen loading states (module splash, app boot) —
// sonar-style rings pulse outward behind a gently breathing icon.
export function LoadingMark({ icon, className }: LoadingMarkProps) {
  return (
    <div className={cn('relative w-40 h-40 flex items-center justify-center', className)}>
      <span className="loading-mark-ring loading-mark-ring-1" />
      <span className="loading-mark-ring loading-mark-ring-2" />
      <div className="loading-mark-icon-wrap relative z-10 w-28 h-28 rounded-full flex items-center justify-center">
        {icon}
      </div>
    </div>
  );
}
