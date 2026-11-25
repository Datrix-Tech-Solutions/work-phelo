'use client';

import { useRouter } from 'next/navigation';
import { Maximize2 } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';

interface DashboardDrilldownPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Where the expand button goes: the full-page view of this list, or any other page.
   * Leave out when the panel is all there is to see. */
  expandHref?: string;
  children: React.ReactNode;
}

/** The small side panel a dashboard card opens to list what is behind its figure. */
export function DashboardDrilldownPanel({
  isOpen,
  onClose,
  title,
  description,
  expandHref,
  children,
}: DashboardDrilldownPanelProps) {
  const router = useRouter();

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      width="sm:w-[480px]"
      headerAction={
        expandHref && (
          <button
            type="button"
            onClick={() => router.push(expandHref)}
            className="text-gray-700 hover:text-brand p-2 rounded-full hover:bg-brand/10 transition-all"
            aria-label="Expand"
            title="Expand"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )
      }
    >
      {children}
    </SidePanel>
  );
}
