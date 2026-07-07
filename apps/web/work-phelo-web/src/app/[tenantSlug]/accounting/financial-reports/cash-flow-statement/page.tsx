'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { PanelLeftClose, PanelRightClose, PanelBottomClose, PanelTopClose } from 'lucide-react';
import { Icons } from '@/components/atoms/icons';
import { cn } from '@/lib/utils';
import { ReportFilterForm } from '@/components/molecules/accounting/ReportFilterForm';
import { ReportHero } from '@/components/molecules/accounting/ReportHero';

export default function CashFlowStatementPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const base = `/${tenantSlug}/accounting/financial-reports`;
  const [collapsed, setCollapsed] = useState(false);
  const [years, setYears] = useState<string[]>([]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Breadcrumb */}
      <div className="px-6 pt-6 pb-4 shrink-0">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={base} className="hover:text-gray-700 transition-colors">
            Financial Reports
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">Cash Flow Statement</span>
        </nav>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Form panel — floating card */}
        <div
          className={cn(
            'flex flex-col shrink-0 overflow-hidden transition-all duration-500',
            'mx-4 mt-1 mb-4 rounded-2xl shadow-md border border-gray-200 bg-white',
            'lg:mx-0 lg:ml-4',
            collapsed ? 'h-14 lg:h-auto lg:w-10' : 'max-h-[45vh] lg:max-h-none lg:w-1/4',
          )}
        >
          {/* Collapse toggle */}
          <div
            className={cn(
              'flex shrink-0 pt-1',
              collapsed ? 'justify-center px-1.5' : 'justify-end px-3',
            )}
          >
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {collapsed ? (
                <>
                  <PanelBottomClose className="w-5 h-5 lg:hidden" />
                  <PanelRightClose className="hidden w-5 h-5 lg:block" />
                </>
              ) : (
                <>
                  <PanelTopClose className="w-5 h-5 lg:hidden" />
                  <PanelLeftClose className="hidden w-5 h-5 lg:block" />
                </>
              )}
            </button>
          </div>

          {/* Form — fades out before overflow-hidden clips it */}
          <div
            className={cn(
              'flex-1 overflow-y-auto px-5 pb-6 pt-4 flex flex-col min-h-0 transition-opacity duration-150',
              collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100',
            )}
          >
            <ReportFilterForm onGenerate={setYears} />
          </div>
        </div>

        {/* Report / hero panel — floating card */}
        <div className="flex-1 min-w-0 min-h-0 mx-4 mb-4 lg:mx-0 lg:mt-1 lg:mr-4 lg:ml-3 rounded-2xl shadow-md border border-gray-200 bg-white overflow-y-auto p-6 flex flex-col gap-4">
          <ReportHero title="Cash Flow Statement" years={years} />
          {years.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-400">Select fiscal year to generate report</p>
            </div>
          ) : (
            <div className="flex-1">{/* report content goes here */}</div>
          )}
        </div>
      </div>
    </div>
  );
}
