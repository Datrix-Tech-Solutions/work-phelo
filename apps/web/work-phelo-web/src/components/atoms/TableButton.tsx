'use client';

import { useState, useRef, ButtonHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export type TableButtonVariant = 'green' | 'blue' | 'orange' | 'red' | 'gray';

const VARIANT_CLASSES: Record<TableButtonVariant, string> = {
  green: 'text-green-700 border-green-600 hover:bg-green-600',
  blue: 'text-blue-700 border-blue-600 hover:bg-blue-600',
  orange: 'text-orange-600 border-orange-500 hover:bg-orange-500',
  red: 'text-red-600 border-red-500 hover:bg-red-500',
  gray: 'text-gray-600 border-gray-400 hover:bg-gray-400',
};

const SPINNER_OUTER: Record<TableButtonVariant, string> = {
  green: 'border-t-green-600',
  blue: 'border-t-blue-600',
  orange: 'border-t-orange-500',
  red: 'border-t-red-500',
  gray: 'border-t-gray-500',
};

const SPINNER_INNER: Record<TableButtonVariant, string> = {
  green: 'border-b-green-300',
  blue: 'border-b-blue-300',
  orange: 'border-b-orange-300',
  red: 'border-b-red-300',
  gray: 'border-b-gray-300',
};

const TOOLTIP_MAX_WIDTH = 240;
const EDGE_GAP = 8;
const ARROW_SIZE = 8;
const ARROW_EDGE_GAP = 12;

interface TableButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: TableButtonVariant;
  tooltip?: string;
}

export function TableButton({
  isLoading,
  disabled,
  variant = 'green',
  tooltip,
  children,
  className,
  ...props
}: TableButtonProps) {
  const [tooltipPos, setTooltipPos] = useState<{
    left: number;
    top: number;
    arrowLeft: number;
  } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (!tooltip || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const idealLeft = rect.left + rect.width / 2 - TOOLTIP_MAX_WIDTH / 2;
    const clampedLeft = Math.max(
      EDGE_GAP,
      Math.min(idealLeft, window.innerWidth - TOOLTIP_MAX_WIDTH - EDGE_GAP),
    );
    // The box is clamped to the screen, so near an edge it no longer sits centred over the
    // button — the arrow has to move within the box to keep pointing at the button.
    const buttonCentre = rect.left + rect.width / 2;
    const arrowLeft = Math.max(
      ARROW_EDGE_GAP,
      Math.min(buttonCentre - clampedLeft, TOOLTIP_MAX_WIDTH - ARROW_EDGE_GAP),
    );
    setTooltipPos({ left: clampedLeft, top: rect.top, arrowLeft });
  };

  return (
    // Hover is tracked on the wrapper, not the button — a disabled button swallows mouse
    // events, and the tooltip is what explains why it's disabled.
    <span
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setTooltipPos(null)}
    >
      <button
        type="button"
        disabled={disabled || isLoading}
        className={cn(
          'text-xs font-medium border hover:text-white hover:scale-[1.2] active:scale-[0.97] rounded px-2 py-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
          VARIANT_CLASSES[variant],
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center justify-center w-8">
            <span className="relative w-3.5 h-3.5">
              <span
                className={cn(
                  'absolute inset-0 rounded-full border-2 border-transparent animate-spin',
                  SPINNER_OUTER[variant],
                )}
              />
              <span
                className={cn(
                  'absolute inset-0.75 rounded-full border-2 border-transparent animate-[spin_.6s_linear_infinite_reverse]',
                  SPINNER_INNER[variant],
                )}
              />
            </span>
          </span>
        ) : (
          children
        )}
      </button>

      {/* Portalled to the page body: a table sitting inside a blurred/transformed card makes
          `position: fixed` relative to that card instead of the screen, which left the tooltip
          floating away from its button. */}
      {tooltipPos &&
        tooltip &&
        createPortal(
          <span
            style={{
              position: 'fixed',
              left: tooltipPos.left,
              top: tooltipPos.top - 8,
              width: TOOLTIP_MAX_WIDTH,
              transform: 'translateY(-100%)',
              zIndex: 9999,
            }}
            className="pointer-events-none"
          >
            <span className="block bg-(--chip-dark,#111827) text-white text-xs rounded-lg px-1 py-1.5 whitespace-nowrap shadow-lg text-center">
              {tooltip}
            </span>
            <span
              className="block w-2 h-2 bg-(--chip-dark,#111827) rotate-45 rounded-sm -mt-1"
              style={{ marginLeft: tooltipPos.arrowLeft - ARROW_SIZE / 2 }}
            />
          </span>,
          document.body,
        )}
    </span>
  );
}
