'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { PanelLeftClose, PanelRightClose } from 'lucide-react';
import { Icons } from '@/components/atoms/icons';
import { cn } from '@/lib/utils';
import { ReportFilterForm } from '@/components/molecules/accounting/ReportFilterForm';

export default function AgedReceivablePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const base = `/${tenantSlug}/accounting/financial-reports`;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Breadcrumb */}
      <div className="px-6 pt-6 pb-4 shrink-0">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={base} className="hover:text-gray-700 transition-colors">
            Financial Reports
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">Aged Receivable</span>
        </nav>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 min-h-0 flex">
        {/* Form panel — floating card */}
        <div
          className={cn(
            'flex flex-col shrink-0 overflow-hidden transition-all duration-500',
            'mt-1 mb-4 ml-4 rounded-2xl shadow-md border border-gray-200 bg-white',
            collapsed ? 'w-10' : 'w-1/4',
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
                <PanelRightClose className="w-5 h-5" />
              ) : (
                <PanelLeftClose className="w-5 h-5" />
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
            <ReportFilterForm onGenerate={(years) => console.log('generate', years)} />
          </div>
        </div>

        {/* Report / hero panel — floating card */}
        <div className="flex-1 min-w-0 mt-1 mb-4 mr-4 ml-3 rounded-2xl shadow-md border border-gray-200 bg-white overflow-y-auto p-6">
          {/* hero header and report content go here */}
        </div>
      </div>
    </div>
  );
}
