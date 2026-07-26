'use client';

import { Button } from '@/components/atoms/Button';

interface EndorsementCloseSectionProps {
  isClosed: boolean;
  isUpdatingStatus: boolean;
  isReadyToClose: boolean;
  onClose: () => void;
}

/** "Close Endorsement" action — renders nothing once the endorsement is already closed. */
export function EndorsementCloseSection({
  isClosed,
  isUpdatingStatus,
  isReadyToClose,
  onClose,
}: EndorsementCloseSectionProps) {
  if (isClosed) return null;

  return (
    <section className="flex flex-col gap-3 border-t border-gray-100 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" isLoading={isUpdatingStatus} disabled={!isReadyToClose} onClick={onClose}>
          Close Endorsement
        </Button>
      </div>
    </section>
  );
}
