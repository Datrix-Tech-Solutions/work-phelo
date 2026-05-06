import { cn } from '@/lib/utils';

export function SectionCard({
  title,
  children,
  scrollX,
  className,
  contentClassName,
}: {
  title: string;
  children: React.ReactNode;
  scrollX?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div className={cn('bg-white border border-gray-200 rounded-card overflow-hidden', className)}>
      <div className="px-6 py-4 border-b border-gray-100 shrink-0">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      {scrollX ? (
        <div className="overflow-x-auto">
          <div className="flex gap-4 px-6 py-5" style={{ width: 'max-content', minWidth: '100%' }}>
            {children}
          </div>
        </div>
      ) : (
        <div className={cn('px-6 py-5', contentClassName)}>{children}</div>
      )}
    </div>
  );
}
