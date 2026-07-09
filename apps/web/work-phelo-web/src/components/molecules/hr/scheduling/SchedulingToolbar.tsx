import { SearchIcon, ChevronRight } from 'lucide-react';
import { cardClass, inputClass } from '@/lib/utils';
import { WeekSelector } from './WeekSelector';

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  departmentId: string;
  onDepartmentChange: (id: string) => void;
  departments: { id: string; name: string }[];
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

export function SchedulingToolbar({
  search,
  onSearchChange,
  departmentId,
  onDepartmentChange,
  departments,
  weekStart,
  onPrevWeek,
  onNextWeek,
}: Props) {
  return (
    <div className={cardClass('flex items-center justify-between shrink-0 mb-6 gap-4 px-4 py-2')}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Search */}
        <div className="relative flex-1 min-w-52 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search employee..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className={inputClass(undefined, 'pl-9 pr-4 py-2')}
          />
        </div>

        {/* Department filter */}
        <div className="relative shrink-0">
          <select
            value={departmentId}
            onChange={(e) => onDepartmentChange(e.target.value)}
            className={inputClass(undefined, 'appearance-none pl-4 pr-8 py-2 font-medium')}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <WeekSelector weekStart={weekStart} onPrev={onPrevWeek} onNext={onNextWeek} endOffset={6} />
    </div>
  );
}
