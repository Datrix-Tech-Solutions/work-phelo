'use client';

import { cardClass, cn } from '@/lib/utils';
import type { ReportTable } from '@/lib/marketing-reports';

/** One table of a generated report. */
export function ReportTableCard({ table }: { table: ReportTable }) {
  const { title, description, columns, rows, footer } = table;
  const align = (j: number) =>
    columns[j]?.align === 'right' ? 'text-right tabular-nums' : 'text-left';

  return (
    <section className={cardClass('p-4 flex flex-col gap-3 min-w-0')}>
      <div>
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">Nothing to report.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {columns.map((c, j) => (
                  <th
                    key={c.label + j}
                    className={cn(
                      'py-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap',
                      align(j),
                    )}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className={cn('py-2 px-2 text-gray-800', align(j))}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footer && (
              <tfoot>
                <tr className="border-t border-gray-300 font-semibold">
                  {footer.map((cell, j) => (
                    <td key={j} className={cn('py-2 px-2 text-gray-900', align(j))}>
                      {cell}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  );
}
