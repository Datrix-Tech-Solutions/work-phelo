'use client';

import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';

interface ApprovePromptModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  isApproving?: boolean;
  onApprove: () => void;
  /** Leave it waiting for approval; it can be approved later from its row or details page. */
  onLater: () => void;
}

/** Offered to someone who can approve what they have just created: approve now, or later. */
export function ApprovePromptModal({
  isOpen,
  title,
  description,
  isApproving,
  onApprove,
  onLater,
}: ApprovePromptModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onLater}
      title={title}
      description={description}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onLater} disabled={isApproving}>
            Later
          </Button>
          <Button onClick={onApprove} isLoading={isApproving} loadingText="Approving...">
            Approve Now
          </Button>
        </div>
      }
    />
  );
}
