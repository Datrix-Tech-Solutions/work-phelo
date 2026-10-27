'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ReportToolbar } from '@/components/molecules/accounting/ReportToolbar';
import { ReportFilterFields } from '@/components/molecules/marketing/ReportFilterFields';
import { ReportTableCard } from '@/components/molecules/marketing/ReportTableCard';
import { extractError } from '@/lib/extractError';
import {
  defaultValues,
  exportReportCsv,
  type ReportDefinition,
  type ReportResult,
  type ReportValues,
} from '@/lib/marketing-reports';
import { cardClass } from '@/lib/utils';

/** One report: its filters, a Generate button, then the stats and tables it produced. */
export function MarketingReportView({ report }: { report: ReportDefinition }) {
  const [values, setValues] = useState<ReportValues>(() => defaultValues(report.filters));
  const [result, setResult] = useState<ReportResult | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const generate = useMutation({
    mutationFn: () => report.run(values),
    onSuccess: (data) => {
      setResult(data);
      setCollapsed(true);
    },
  });

  const ready = report.filters.every((f) =>
    f.kind === 'dateRange'
      ? !!values.from && !!values.to
      : f.kind === 'year'
        ? !!values.year
        : true,
  );

  return (
    <section className="flex flex-col gap-6">
      <ReportToolbar
        fields={
          <ReportFilterFields filters={report.filters} values={values} onChange={setValues} />
        }
        summary={
          result && (
            <>
              {result.subtitle.map((line) => (
                <span
                  key={line}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                >
                  {line}
                </span>
              ))}
            </>
          )
        }
        collapsed={collapsed && !!result}
        hasReport={!!result}
        onToggle={() => setCollapsed((c) => !c)}
        onGenerate={() => generate.mutate()}
        generateDisabled={!ready}
        generating={generate.isPending}
        onDownloadCsv={() => result && exportReportCsv(report.key, result)}
        downloadDisabled={!result || result.tables.every((t) => t.rows.length === 0)}
      />

      {generate.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Unable to generate {report.title.toLowerCase()}: {extractError(generate.error)}
        </div>
      ) : !result ? (
        <p className="py-16 text-center text-sm text-gray-400">
          Choose your filters and generate the report.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <header className={cardClass('px-6 py-5 text-center')}>
            <h2 className="text-lg font-semibold text-gray-900">{report.title}</h2>
            {result.subtitle.map((line) => (
              <p key={line} className="mt-1 text-sm text-gray-600">
                {line}
              </p>
            ))}
          </header>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {result.stats.map((stat) => (
              <div key={stat.label} className={cardClass('p-4 flex flex-col gap-1')}>
                <span className="text-xs text-gray-500">{stat.label}</span>
                <span className="text-xl font-bold text-gray-900 tabular-nums">{stat.value}</span>
              </div>
            ))}
          </div>

          {result.tables.map((table) => (
            <ReportTableCard key={table.title} table={table} />
          ))}
        </div>
      )}
    </section>
  );
}
