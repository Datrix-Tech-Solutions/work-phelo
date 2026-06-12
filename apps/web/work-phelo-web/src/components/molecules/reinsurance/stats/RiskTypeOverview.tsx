'use client';

import { useState } from 'react';
import { DetailField } from '@/components/atoms/DetailField';
import { Badge } from '@/components/atoms/Badge';
import { Icons } from '@/components/atoms/icons';
import { RiskType } from '@/types/reinsurance';

interface RiskTypeOverviewProps {
  riskType: RiskType;
  riskClassName: string;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function RiskTypeOverview({ riskType, riskClassName }: RiskTypeOverviewProps) {
  const [collapsed, setCollapsed] = useState(false);

  const businessFields = riskType.fields.filter((f) => f.section === 'BUSINESS_DETAILS');
  const offerFields = riskType.fields.filter((f) => f.section === 'OFFER_DETAILS');

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Overview</h2>
          <Badge
            label={riskType.isActive ? 'Active' : 'Inactive'}
            variant={riskType.isActive ? 'success' : 'neutral'}
          />
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label={collapsed ? 'Expand overview' : 'Collapse overview'}
        >
          <Icons.ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
          />
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
            <DetailField label="Name" value={riskType.name} />
            <DetailField label="Risk Class" value={riskClassName} />
            <DetailField label="Description" value={riskType.description ?? '—'} />
            <DetailField label="Created" value={fmtDate(riskType.createdAt)} />
          </div>

          {riskType.fields.length > 0 && (
            <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Custom Fields
              </span>
              <div className="flex flex-col gap-4">
                {businessFields.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-gray-400">Business Details</span>
                    <div className="flex flex-wrap gap-2">
                      {businessFields.map((f) => (
                        <span
                          key={f.id}
                          className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-xs font-medium text-gray-700"
                        >
                          {f.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {offerFields.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-gray-400">Offer Details</span>
                    <div className="flex flex-wrap gap-2">
                      {offerFields.map((f) => (
                        <span
                          key={f.id}
                          className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-xs font-medium text-gray-700"
                        >
                          {f.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
