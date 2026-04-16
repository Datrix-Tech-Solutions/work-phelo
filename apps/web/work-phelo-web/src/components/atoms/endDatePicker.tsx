'use client';

import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthPickerProps {
  label?: string;
  value?: string; // ISO string: "2026-07" (YYYY-MM)
  onChange: (value: string) => void; // returns "YYYY-MM"
  placeholder?: string;
  className?: string;
  disabled?: boolean;
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
}: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Parse current value
  const selectedDate = value ? new Date(value + '-01') : null;

  // Generate months for current year (you can extend to show multiple years if needed)
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i,
    name: MONTH_NAMES[i],
    value: `${currentYear}-${String(i + 1).padStart(2, '0')}`,
  }));

  const handleSelect = (monthValue: string) => {
    onChange(monthValue);
    setIsOpen(false);
  };

  const goToPrevYear = () => setCurrentYear((y) => y - 1);
  const goToNextYear = () => setCurrentYear((y) => y + 1);

  // Format display text
  const displayText = selectedDate
    ? `${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
    : placeholder;

  return (
    <div className={cn('relative', className)}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}

      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
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

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-2xl shadow-xl py-4 px-4">
          {/* Year Header */}
          <div className="flex items-center justify-between mb-4 px-2">
            <button
              onClick={goToPrevYear}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-gray-900">{currentYear}</span>
            <button
              onClick={goToNextYear}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Months Grid */}
          <div className="grid grid-cols-3 gap-2">
            {months.map((m) => {
              const isSelected = value === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => handleSelect(m.value)}
                  className={cn(
                    'py-3 px-4 text-sm rounded-xl transition-all',
                    isSelected
                      ? 'bg-brand text-white font-medium'
                      : 'hover:bg-gray-100 text-gray-700',
                  )}
                >
                  {m.name}
                </button>
              );
            })}
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
        </div>
      )}
    </div>
  );
}
