'use client';

import { Calendar } from 'lucide-react';
import { formatHolidayDate } from '@/lib/formatters';

interface Holiday {
  id: string;
  name: string;
  date: string;
}

interface UpcomingHolidaysCardProps {
  holidays: Holiday[];
}

export function UpcomingHolidaysCard({ holidays }: UpcomingHolidaysCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-card p-5 flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
      <h2 className="text-base font-bold text-gray-900">Upcoming Holidays</h2>
      {holidays.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <p className="text-sm text-gray-400">No upcoming public holidays</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {holidays.map((h) => (
            <div key={h.id} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400">{formatHolidayDate(h.date, true)}</p>
                <p className="text-sm font-semibold text-gray-900">{h.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
