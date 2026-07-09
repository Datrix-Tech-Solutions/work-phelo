'use client';

import { Calendar } from 'lucide-react';
import { formatHolidayDate } from '@/lib/formatters';
import { cardClass } from '@/lib/utils';

interface Holiday {
  id: string;
  name: string;
  date: string;
  observedDate?: string;
}

interface UpcomingHolidaysCardProps {
  holidays: Holiday[];
}

export function UpcomingHolidaysCard({ holidays }: UpcomingHolidaysCardProps) {
  return (
    <div className={cardClass('p-5 flex flex-col gap-3 min-h-60 border-gray-200')}>
      <h2 className="text-base font-bold text-gray-900">Upcoming Holidays</h2>
      {holidays.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <p className="text-sm text-gray-400">No upcoming public holidays</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {holidays.map((h) => (
            <div key={h.id} className="flex items-center gap-3">
              <div
                className="relative w-9 h-9 shrink-0 rounded-full flex items-center justify-center overflow-hidden"
                style={{
                  background:
                    'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.95) 0%, rgba(219,234,254,0.85) 30%, rgba(147,197,253,0.65) 60%, rgba(59,130,246,0.55) 100%)',
                  boxShadow:
                    'inset -2px -2px 4px rgba(30,64,175,0.25), inset 1.5px 1.5px 3px rgba(255,255,255,0.9), 0 3px 6px -1px rgba(59,130,246,0.45)',
                }}
              >
                <span className="absolute top-1 left-1.5 w-2 h-1.5 rounded-full bg-white/85 blur-[1px]" />
                <Calendar className="w-4 h-4 text-blue-700/80 relative" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400">
                  {formatHolidayDate(h.observedDate ?? h.date, true)}
                </p>
                <p className="text-sm font-semibold text-gray-900 truncate">{h.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
