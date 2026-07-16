'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, popupClass } from '@/lib/utils';
import { useDropdownPosition } from '@/hooks';

interface MonthPickerProps {
  label?: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  disablePast?: boolean;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function MonthPicker({
  label,
  value,
  onChange,
  placeholder = 'Select month',
  className,
  disabled = false,
  disablePast = false,
}: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { pos: dropdownPos } = useDropdownPosition(isOpen, containerRef);
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Normalise to YYYY-MM — backend may return a full date string (YYYY-MM-DD or ISO)
  const normalizedValue = value ? value.substring(0, 7) : undefined;

  const [viewYear, setViewYear] = useState(
    normalizedValue ? parseInt(normalizedValue.split('-')[0]) : currentYear,
  );

  const selectedDate = normalizedValue ? new Date(normalizedValue + '-01') : null;

  // Generate months for the current viewed year
  const months = Array.from({ length: 12 }, (_, i) => {
    const monthValue = `${viewYear}-${String(i + 1).padStart(2, '0')}`;
    const isPast =
      disablePast && (viewYear < currentYear || (viewYear === currentYear && i < currentMonth));

    return {
      month: i,
      name: MONTH_NAMES[i],
      value: monthValue,
      isPast,
    };
  });

  const handleSelect = (monthValue: string) => {
    onChange(monthValue);
    setIsOpen(false);
  };

  const goToPrevYear = () => setViewYear((y) => y - 1);
  const goToNextYear = () => setViewYear((y) => y + 1);

  const displayText =
    selectedDate && !isNaN(selectedDate.getTime())
      ? `${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
      : placeholder;

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}

      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
        }}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-input bg-white text-left text-sm',
          'focus:outline-none focus:ring-1 focus:ring-brand',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        <span className={selectedDate ? 'text-gray-900' : 'text-gray-400'}>{displayText}</span>
        <Calendar className="w-5 h-5 text-gray-400" />
      </button>

      {/* Portaled to <body> so the dropdown overlays in place instead of pushing the rest of the form down. */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              bottom: dropdownPos.bottom,
              left: dropdownPos.left,
              width: dropdownPos.width,
              maxHeight: dropdownPos.maxHeight,
            }}
            className={popupClass('z-50 overflow-auto py-4 px-4')}
          >
            {/* Year Header */}
            <div className="flex items-center justify-between mb-4 px-2">
              <button
                onClick={goToPrevYear}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-semibold text-gray-900">{viewYear}</span>
              <button
                onClick={goToNextYear}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Months Grid */}
            <div className="grid grid-cols-3 gap-2">
              {months.map((m) => (
                <button
                  key={m.value}
                  onClick={() => !m.isPast && handleSelect(m.value)}
                  disabled={m.isPast}
                  className={cn(
                    'py-3 px-4 text-sm rounded-xl transition-all',
                    m.isPast && 'opacity-40 cursor-not-allowed',
                    normalizedValue === m.value
                      ? 'bg-brand text-white font-medium'
                      : !m.isPast && 'hover:bg-gray-100 text-gray-700',
                  )}
                >
                  {m.name}
                </button>
              ))}
            </div>

            {/* Quick "3 Months from now" button */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  const now = new Date();
                  const future = new Date(now.getFullYear(), now.getMonth() + 3, 1);
                  const futureStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}`;
                  onChange(futureStr);
                  setIsOpen(false);
                }}
                className="w-full py-2.5 text-sm text-brand hover:bg-brand/5 rounded-xl transition-colors"
              >
                Set to 3 months from now
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
