'use client';

import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import { cardClass, cn } from '@/lib/utils';

/**
 * The filter card shared by the financial reports: filter fields on top (folded into a
 * summary once a report exists), and the action row underneath, which is always visible.
 */
export function ReportToolbar({
  fields,
  summary,
  collapsed,
  hasReport,
  onToggle,
  onGenerate,
  generateDisabled,
  generating,
  onDownloadPdf,
  onDownloadCsv,
  downloadDisabled,
  pdfBusy,
}: {
  fields: React.ReactNode;
  /** Chips describing the filters the visible report was generated with. */
  summary: React.ReactNode;
  collapsed: boolean;
  /** Whether a report has been generated yet; the collapse toggle only exists after that. */
  hasReport: boolean;
  onToggle: () => void;
  onGenerate: () => void;
  generateDisabled: boolean;
  generating: boolean;
  onDownloadPdf: () => void;
  onDownloadCsv: () => void;
  downloadDisabled: boolean;
  pdfBusy: boolean;
}) {
  return (
    <div className={cardClass('p-4 flex flex-col gap-4')}>
      {!collapsed && <div className="flex flex-wrap items-end gap-4">{fields}</div>}
      {collapsed && <div className="flex flex-wrap items-center gap-2">{summary}</div>}

      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200">
        <Button
          onClick={onGenerate}
          disabled={generateDisabled}
          isLoading={generating}
          loadingText="Generating…"
        >
          Generate Report
        </Button>
        <Button
          variant="outline"
          onClick={onDownloadPdf}
          disabled={downloadDisabled || pdfBusy}
          icon={<Icons.Download className="w-4 h-4" />}
        >
          {pdfBusy ? 'Preparing PDF…' : 'Download PDF'}
        </Button>
        <Button
          variant="outline"
          onClick={onDownloadCsv}
          disabled={downloadDisabled}
          icon={<Icons.Download className="w-4 h-4" />}
        >
          Download CSV
        </Button>
        {hasReport && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            {collapsed ? 'Edit filters' : 'Hide filters'}
            <Icons.ChevronDown
              className={cn('w-4 h-4 transition-transform', !collapsed && 'rotate-180')}
            />
          </button>
        )}
      </div>
    </div>
  );
}
