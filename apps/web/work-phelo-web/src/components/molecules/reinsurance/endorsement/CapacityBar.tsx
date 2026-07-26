'use client';

interface CapacityBarRow {
  counterpartyId: string;
  reinsurerName: string;
  share: number;
}

interface CapacityBarProps {
  acceptedPercent: number;
  targetPercent: number;
  rows: CapacityBarRow[];
  colorMap: Record<string, string>;
}

/** Segmented capacity bar — one colored segment per accepted reinsurer, with a legend below. */
export function CapacityBar({ acceptedPercent, targetPercent, rows, colorMap }: CapacityBarProps) {
  if (targetPercent <= 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-medium text-gray-500">
        <span>Accepted Capacity</span>
        <span>
          <span className="text-gray-700">{acceptedPercent}%</span>
          <span className="text-gray-400"> / {targetPercent}%</span>
        </span>
      </div>

      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
        {rows.map((row) => (
          <div
            key={row.counterpartyId}
            style={{
              width: `${(row.share / targetPercent) * 100}%`,
              backgroundColor: colorMap[row.counterpartyId],
            }}
            className="h-full transition-all duration-500"
          />
        ))}
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {rows.map((row) => (
            <div key={row.counterpartyId} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: colorMap[row.counterpartyId] }}
              />
              <span className="text-xs font-medium" style={{ color: colorMap[row.counterpartyId] }}>
                {row.reinsurerName}
                <span className="text-gray-400 font-normal"> · {row.share}%</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
