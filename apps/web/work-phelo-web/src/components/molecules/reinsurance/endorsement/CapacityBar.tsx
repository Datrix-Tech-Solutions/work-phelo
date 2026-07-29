'use client';

interface CapacityBarRow {
  counterpartyId: string;
  reinsurerName: string;
  share: number;
}

interface CapacityBarProps {
  acceptedPercent: number;
  targetPercent: number;
  /** The offer % before this endorsement, so the target can be shown as "original + added". */
  originalPercent?: number;
  rows: CapacityBarRow[];
  colorMap: Record<string, string>;
}

/** Segmented capacity bar — one colored segment per accepted reinsurer, with a legend below. */
export function CapacityBar({
  acceptedPercent,
  targetPercent,
  originalPercent,
  rows,
  colorMap,
}: CapacityBarProps) {
  if (targetPercent <= 0) return null;

  const delta = originalPercent != null ? +(targetPercent - originalPercent).toFixed(4) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-medium text-gray-500">
        <span>Accepted Capacity</span>
        <span>
          <span className="text-gray-700 text-[13px] font-bold">{acceptedPercent}%</span>
          <span className="text-gray-400 text-[13px] font-bold"> / {targetPercent}%</span>
          {delta !== 0 && (
            <span className="text-gray-400 text-[10px] font-bold">
              {' '}
              ({originalPercent}%
              <span className={delta > 0 ? 'text-green-600' : 'text-red-500'}>
                {' '}
                {delta > 0 ? '+' : ''}
                {delta}%
              </span>
              )
            </span>
          )}
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

      <p className="text-xs text-gray-400">
        Available:{' '}
        <span className="text-[13px] font-bold text-gray-600">
          {Math.max(0, +(targetPercent - acceptedPercent).toFixed(4))}%
        </span>
      </p>

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
