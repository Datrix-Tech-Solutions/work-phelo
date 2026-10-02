import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';

interface Props {
  isOpen: boolean;
  itemLabel: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function RenameInUseModal({ isOpen, itemLabel, isLoading, onConfirm, onClose }: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${itemLabel} in use`}
      description={`This ${itemLabel.toLowerCase()} is in use by one or more prospects. Renaming it will update the name everywhere it appears. Would you still like to change it?`}
      width="max-w-sm"
      height="max-h-fit"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} isLoading={isLoading}>
            Yes, change it
          </Button>
        </>
      }
    />
  );
}
