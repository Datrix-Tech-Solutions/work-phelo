'use client';

import { useState } from 'react';

export interface RateDataPoint {
  date: string;
  rate: number;
}

interface CurrencyRateTrendChartProps {
  data: RateDataPoint[];
  isoCode: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function CurrencyRateTrendChart({ data, isoCode }: CurrencyRateTrendChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">
        No rate history available for {isoCode}.
      </div>
    );
  }

  const W = 700;
  const H = 220;
  const PL = 60;
  const PR = 24;
  const PT = 20;
  const PB = 44;

  const cW = W - PL - PR;
  const cH = H - PT - PB;

  const rates = data.map((d) => d.rate);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const spread = maxRate - minRate || 1;
  const padded = spread * 0.15;
  const yMin = minRate - padded;
  const yMax = maxRate + padded;
  const yRange = yMax - yMin;

  function toX(i: number) {
    return PL + (i / Math.max(data.length - 1, 1)) * cW;
  }
  function toY(rate: number) {
    return PT + cH - ((rate - yMin) / yRange) * cH;
  }

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)},${toY(d.rate).toFixed(1)}`)
    .join(' ');

  const areaPath =
    linePath +
    ` L ${toX(data.length - 1).toFixed(1)},${(PT + cH).toFixed(1)}` +
    ` L ${toX(0).toFixed(1)},${(PT + cH).toFixed(1)} Z`;

  // Y-axis ticks — 4 evenly spaced
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (i / 4) * yRange);

  // X-axis labels — show up to 6 evenly spaced dates
  const maxLabels = Math.min(6, data.length);
  const labelStep = Math.max(1, Math.floor((data.length - 1) / (maxLabels - 1)));
  const labelIndices = Array.from({ length: maxLabels }, (_, i) =>
    Math.min(i * labelStep, data.length - 1),
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ userSelect: 'none', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines + Y labels */}
      {yTicks.map((tick, i) => {
        const y = toY(tick);
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PL - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#9ca3af">
              {tick.toFixed(2)}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <path d={areaPath} fill="url(#rateGradient)" />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke="#f97316"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* X-axis labels */}
      {labelIndices.map((idx) => (
        <text
          key={idx}
          x={toX(idx)}
          y={PT + cH + 18}
          textAnchor="middle"
          fontSize={11}
          fill="#9ca3af"
        >
          {formatDate(data[idx].date)}
        </text>
      ))}

      {/* Hover targets + dots */}
      {data.map((d, i) => {
        const cx = toX(i);
        const cy = toY(d.rate);
        const isHov = hovered === i;
        const tW = 140;
        const tH = 52;
        const aH = 8;
        const aHW = 6;
        const tx = Math.max(PL, Math.min(W - PR - tW, cx - tW / 2));
        const ty = cy - tH - aH - 6;
        const ax = Math.max(tx + aHW + 4, Math.min(tx + tW - aHW - 4, cx));

        return (
          <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            {/* Invisible wide hit target */}
            <rect
              x={cx - cW / data.length / 2}
              y={PT}
              width={cW / data.length}
              height={cH}
              fill="transparent"
            />

            {/* Dot */}
            <circle
              cx={cx}
              cy={cy}
              r={isHov ? 5 : 3}
              fill={isHov ? '#f97316' : '#f97316'}
              stroke="white"
              strokeWidth={2}
              style={{ transition: 'r 0.1s ease' }}
            />

            {/* Tooltip */}
            {isHov && (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={tx}
                  y={ty}
                  width={tW}
                  height={tH}
                  rx={6}
                  fill="white"
                  stroke="#f97316"
                  strokeWidth={1.5}
                />
                <rect x={ax - aHW} y={ty + tH - 1.5} width={aHW * 2} height={3} fill="white" />
                <path
                  d={`M ${ax - aHW},${ty + tH + 1} L ${ax},${ty + tH + aH} L ${ax + aHW},${ty + tH + 1} Z`}
                  fill="white"
                />
                <path
                  d={`M ${ax - aHW},${ty + tH} L ${ax},${ty + tH + aH} L ${ax + aHW},${ty + tH}`}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
                <text x={tx + 12} y={ty + 22} fontSize={13} fontWeight="600" fill="#111827">
                  {d.rate.toFixed(4)}
                </text>
                <text x={tx + 12} y={ty + 40} fontSize={11} fill="#6b7280">
                  {formatDate(d.date)}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
