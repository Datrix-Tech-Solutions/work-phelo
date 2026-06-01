'use client';

import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import FacultativeFormFields from '@/components/molecules/reinsurance/forms/FacultativeFormFields';
import { FacultativeFormValues, FACULTATIVE_FORM_DEFAULTS } from '@/types/reinsurance';

interface CreateFacultativePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateFacultativePanel({ isOpen, onClose }: CreateFacultativePanelProps) {
  const form = useForm<FacultativeFormValues>({
    defaultValues: FACULTATIVE_FORM_DEFAULTS,
  });

  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form;

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async () => {
    handleClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Facultative Placement Slip"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} isLoading={isSubmitting} loadingText="Saving…">
            Save
          </Button>
        </div>
      }
    >
      <FacultativeFormFields form={form} />
    </SidePanel>
  );
}
