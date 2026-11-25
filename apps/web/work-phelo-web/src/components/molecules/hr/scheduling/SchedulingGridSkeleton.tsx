import { Skeleton } from '@/components/atoms/Skeleton';
import { getSchedulingGridLayout } from './schedulingGridLayout';

const SKELETON_ROWS = 6;
const SKELETON_HAS_SHIFT = [
  [true, false, true, false, true, false, true],
  [false, true, false, true, false, true, false],
  [true, true, false, false, true, false, true],
  [false, false, true, false, false, true, false],
  [true, false, false, true, true, false, false],
  [false, true, true, false, false, true, true],
];

export function SchedulingGridSkeleton({ columns = 7 }: { columns?: number }) {
  const { gridTemplateColumns, minWidth } = getSchedulingGridLayout(columns);
  const dayColumns = Array.from({ length: columns }, (_, i) => i);

  return (
    <div
      className="border border-gray-200 rounded-card bg-white shadow-sm overflow-hidden"
      style={{ minWidth }}
    >
      {/* Header */}
      <div className="grid bg-gray-50 border-b border-gray-200" style={{ gridTemplateColumns }}>
        <div className="px-5 py-3.5">
          <Skeleton className="h-3 w-16" />
        </div>
        {dayColumns.map((i) => (
          <div key={i} className="px-2 py-3.5 text-center border-l border-gray-200">
            <Skeleton className="h-3 w-12 mx-auto" />
          </div>
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: SKELETON_ROWS }).map((_, rowIdx) => (
        <div key={rowIdx} className="grid border-t border-gray-100" style={{ gridTemplateColumns }}>
          <div className="px-5 py-4 border-r border-gray-100 flex items-center">
            <Skeleton className="h-4 w-28" />
          </div>
          {dayColumns.map((colIdx) => (
            <div
              key={colIdx}
              className={`border-l border-gray-100 min-h-20 ${columns > 7 ? 'p-1' : 'p-3'}`}
            >
              {SKELETON_HAS_SHIFT[rowIdx][colIdx % 7] && (
                <Skeleton className="h-10 w-full rounded-xl" />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
