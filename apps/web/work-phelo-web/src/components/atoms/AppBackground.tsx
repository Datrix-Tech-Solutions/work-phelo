import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { cn } from '@/lib/utils';

type AppBackgroundProps<T extends ElementType> = {
  as?: T;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>;

// Single source of truth for the app shell background — a flat fill in the active
// module's accent color (--module-accent, see globals.css), falling back to brand accent.
export function AppBackground<T extends ElementType = 'div'>({
  as,
  className,
  children,
  ...props
}: AppBackgroundProps<T>) {
  const Component = as ?? 'div';
  return (
    <Component
      className={cn('relative isolate', className)}
      style={{
        background:
          'color-mix(in oklch, var(--module-accent, var(--brand-accent)) 5%, var(--background))',
      }}
      {...props}
    >
      {/* <div aria-hidden className="app-blob-layer">
        <span className="app-blob app-blob-1" />
        <span className="app-blob app-blob-2" />
      </div> */}
      {children}
    </Component>
  );
}
