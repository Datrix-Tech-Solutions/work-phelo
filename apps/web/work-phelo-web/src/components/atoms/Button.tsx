import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading,
      loadingText,
      icon,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const base =
      'inline-flex items-center justify-center font-medium rounded-input transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.1] active:scale-[0.97] disabled:hover:scale-100';

    const variants = {
      primary:
        'bg-(--module-btn-bg,var(--color-brand)) text-white hover:bg-(--module-btn-bg-hover,var(--color-brand-hover)) focus:ring-(--module-btn-bg,var(--color-brand))',
      secondary:
        'bg-gray-100 text-gray-900 border border-gray-400 hover:bg-(--module-tint,var(--color-brand-tint)) hover:border-(--module-btn-bg,var(--color-brand)) focus:ring-gray-500',
      outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500',
      ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    };

    const sizes = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-5 py-2 text-sm',
      lg: 'px-6 py-4 text-base',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(base, variants[variant], sizes[size], icon && 'group', className)}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            {loadingText ?? children}
            <div className="relative w-5 h-5">
              <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-[#FFFFFF] animate-spin" />
              <div className="absolute inset-1.5 rounded-full border-3 border-transparent border-b-brand-accent animate-[spin_.6s_linear_infinite_reverse]" />
            </div>
          </span>
        ) : (
          <>
            {children}
            {icon && (
              <span className="inline-flex overflow-hidden w-0 group-hover:w-4 group-hover:ml-1.5 transition-[width,margin] duration-300 ease-out">
                <span className="shrink-0 -translate-x-4 group-hover:translate-x-0 transition-transform duration-300 ease-out">
                  {icon}
                </span>
              </span>
            )}
          </>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
