'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { JournalEntryDetailsSection } from '@/components/molecules/accounting/JournalEntryDetailsSection';
import { JournalLinesSection } from '@/components/molecules/accounting/JournalLinesSection';
import { JournalEntryFormValues, JOURNAL_ENTRY_DEFAULTS } from '@/types/accounting';
import { Icons } from '@/components/atoms/icons';
import { cardClass } from '@/lib/utils';
import { useCreateJournal } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface NewJournalEntryFormProps {
  onCancel: () => void;
  onSaved: () => void;
}

export function NewJournalEntryForm({ onCancel, onSaved }: NewJournalEntryFormProps) {
  const form = useForm<JournalEntryFormValues>({ defaultValues: JOURNAL_ENTRY_DEFAULTS });
  const [showCancelModal, setShowCancelModal] = useState(false);
  const toast = useToast();
  const { mutateAsync: createJournal, isPending } = useCreateJournal();

  const onSubmit = async (data: JournalEntryFormValues) => {
    if (!data.fiscalPeriodId) {
      toast.error('No open fiscal period covers this transaction date');
      return;
    }

    const lines = data.lines.filter((l) => l.targetAccount && (l.debit || l.credit));
    const debitTotal = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
    const creditTotal = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
    if (lines.length < 2) {
      toast.error('A journal entry needs at least 2 lines');
      return;
    }
    if (debitTotal !== creditTotal) {
      toast.error('Debit and credit totals must be equal');
      return;
    }

    try {
      await createJournal({
        transactionDate: data.transactionDate,
        fiscalPeriodId: data.fiscalPeriodId,
        transactionCurrency: data.currency,
        exchangeRate: data.exchangeRate || undefined,
        reference: data.reference || undefined,
        description: data.description,
        lines: lines.map((l) => ({
          glAccountId: l.targetAccount,
          description: l.description || undefined,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        })),
      });
      toast.success('Journal entry saved as draft');
      onSaved();
    } catch (err) {
      toast.error(extractError(err, 'Failed to save journal entry'));
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Entry details card */}
        <div className={cardClass('p-6')}>
          <JournalEntryDetailsSection form={form} />
        </div>

        {/* Journal lines */}
        <JournalLinesSection form={form} />

        {/* Action row */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setShowCancelModal(true)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            icon={<Icons.Save className="w-4 h-4" />}
            isLoading={isPending}
            loadingText="Saving…"
            onClick={form.handleSubmit(onSubmit)}
          >
            Save as Draft
          </Button>
          {/* No backend workflow status for "review" yet (JournalStatus is only
              DRAFT/POSTED/REVERSED) — this creates the same draft as "Save as Draft". */}
          <Button
            variant="primary"
            isLoading={isPending}
            loadingText="Saving…"
            onClick={form.handleSubmit(onSubmit)}
          >
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
