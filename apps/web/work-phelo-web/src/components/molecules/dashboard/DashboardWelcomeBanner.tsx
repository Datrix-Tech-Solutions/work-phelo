'use client';

import { getGreeting } from '@/lib/formatters';

interface DashboardWelcomeBannerProps {
  tenantName: string;
  fullName: string;
}

export function DashboardWelcomeBanner({ tenantName, fullName }: DashboardWelcomeBannerProps) {
  return (
    <div
      className="rounded-card px-8 py-5 flex items-center justify-between shrink-0"
      style={{ background: 'linear-gradient(to right, #0D1F44, #1E3A8A)' }}
    >
      <div>
        <p className="text-sm font-semibold text-orange-400">{tenantName}</p>
        <h1 className="text-2xl font-bold text-white mt-0.5">
          {getGreeting()}, {fullName}
        </h1>
      </div>
    </div>
  );
}
