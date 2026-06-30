'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { JournalEntryDetailsSection } from '@/components/molecules/accounting/JournalEntryDetailsSection';
import { JournalLinesSection } from '@/components/molecules/accounting/JournalLinesSection';
import { JournalEntryFormValues, JOURNAL_ENTRY_DEFAULTS } from '@/types/accounting';
import { Icons } from '@/components/atoms/icons';

interface NewJournalEntryFormProps {
  onCancel: () => void;
}

export function NewJournalEntryForm({ onCancel }: NewJournalEntryFormProps) {
  const form = useForm<JournalEntryFormValues>({ defaultValues: JOURNAL_ENTRY_DEFAULTS });
  const [showCancelModal, setShowCancelModal] = useState(false);

  const onSubmit = () => {};

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Entry details card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <JournalEntryDetailsSection form={form} />
        </div>

        {/* Journal lines */}
        <JournalLinesSection form={form} />

        {/* Action row */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setShowCancelModal(true)}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            icon={<Icons.Save className="w-4 h-4" />}
            onClick={form.handleSubmit(onSubmit)}
          >
            Save as Draft
          </Button>
          <Button variant="primary" onClick={form.handleSubmit(onSubmit)}>
            Submit for Review
          </Button>
        </div>
      </div>

      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Entry"
        description="Are you sure you want to cancel the journal entry creation?"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>
              Go Back
            </Button>
            <Button variant="danger" onClick={onCancel}>
              Yes, Cancel
            </Button>
          </>
        }
      />
    </>
  );
}
