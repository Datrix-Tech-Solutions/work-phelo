import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { cn } from '@/lib/utils';

type AppBackgroundProps<T extends ElementType> = {
  as?: T;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>;

// Single source of truth for the app shell background — see --app-shell in globals.css.
export function AppBackground<T extends ElementType = 'div'>({
  as,
  className,
  children,
  ...props
}: AppBackgroundProps<T>) {
  const Component = as ?? 'div';
  return (
    <Component className={cn('relative isolate bg-app-shell', className)} {...props}>
      <div aria-hidden className="app-blob-layer">
        <span className="app-blob app-blob-1" />
        <span className="app-blob app-blob-2" />
        <span className="app-blob app-blob-3" />
        {/* <span className="app-blob app-blob-3" />
        <span className="app-blob app-blob-3" />
        <span className="app-blob app-blob-3" /> */}
      </div>
      {children}
    </Component>
  );
}
