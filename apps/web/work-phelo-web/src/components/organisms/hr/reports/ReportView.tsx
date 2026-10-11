'use client';

import { ReportChartBlock } from '@/components/organisms/hr/reports/ReportChartBlock';
import { ReportTableBlock } from '@/components/organisms/hr/reports/ReportTableBlock';
import { ReportSpec } from '@/types/reports';

interface ReportViewProps {
  spec: ReportSpec;
}

/** Draws a report: its table, or its charts side by side. */
export function ReportView({ spec }: ReportViewProps) {
  if (spec.type === 'TABLE') {
    return spec.blocks[0] ? <ReportTableBlock block={spec.blocks[0]} period={spec.period} /> : null;
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      {spec.blocks.map((block, index) => (
        <ReportChartBlock
          key={index}
          block={block}
          period={spec.period}
          fallbackTitle={`Chart ${index + 1}`}
        />
      ))}
    </div>
  );
}
