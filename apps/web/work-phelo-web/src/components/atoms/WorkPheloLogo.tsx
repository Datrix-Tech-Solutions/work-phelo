import { cn } from '@/lib/utils';

interface WorkPheloLogoProps {
  className?: string;
}

export function WorkPheloLogo({ className }: WorkPheloLogoProps) {
  return (
    <span className={cn('text-xl font-bold tracking-tight', className)}>
      <span className="text-orange-500">WORK</span>
      <span className="text-[#0D2244]">Phelo</span>
    </span>
  );
}
