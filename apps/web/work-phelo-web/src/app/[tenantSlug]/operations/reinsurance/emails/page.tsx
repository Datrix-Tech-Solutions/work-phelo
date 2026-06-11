'use client';

import { use } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';

export default function ReinsuranceEmailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  return (
    <div className="flex flex-col items-center justify-center h-70% p-8 text-center">
      <Mail size={48} className="text-slate-300 mb-4" />
      <h2 className="text-xl font-bold text-slate-900 mb-2">Placement Email Threads</h2>
      <p className="text-slate-500 mb-6 max-w-sm">
        Placement-linked email conversations are now available from each facultative placement. Open
        a placement and use the Emails tab to review synced thread history.
      </p>
      <Link
        href={`/${tenantSlug}/operations/reinsurance/facultative`}
        className="inline-flex items-center justify-center rounded-input bg-brand px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
      >
        View placements
      </Link>
    </div>
  );
}
