'use client';

import { useRouter } from 'next/navigation';
import { Icons } from '@/components/atoms/icons';

interface DashboardPageHeaderProps {
  title: string;
  description: string;
  /** The dashboard to go back to. */
  backHref: string;
}

/** Heading of a page that only the dashboard leads to, with the way back. */
export function DashboardPageHeader({ title, description, backHref }: DashboardPageHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => router.push(backHref)}
        className="p-1 rounded-full text-gray-600 hover:bg-gray-100"
        aria-label="Back to dashboard"
      >
        <Icons.ChevronLeft />
      </button>
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
  );
}
