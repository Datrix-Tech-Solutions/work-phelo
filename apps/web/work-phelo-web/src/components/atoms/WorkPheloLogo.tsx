import Image from 'next/image';
import { cn } from '@/lib/utils';

interface WorkPheloLogoProps {
  className?: string;
  variant?: 'text' | 'image';
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
}

export function WorkPheloLogo({
  className,
  variant = 'text',
  src,
  alt = 'WorkPhelo logo',
  width = 80,
  height = 32,
}: WorkPheloLogoProps) {
  if (variant === 'image' && src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={cn('object-contain', className)}
      />
    );
  }

  return (
    <span className={cn('text-xl font-bold tracking-tight', className)}>
      <span className="text-orange-500">WORK</span>
      <span className="text-brand">Phelo</span>
    </span>
  );
}
