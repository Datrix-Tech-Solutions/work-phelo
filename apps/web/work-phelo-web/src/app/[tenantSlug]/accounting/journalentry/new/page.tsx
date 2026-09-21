'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';
import { FileUpload } from '@/components/atoms/FileUpload';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Modal } from '@/components/organisms/shared/Modal';
import { JournalEntryDetailsSection } from '@/components/molecules/accounting/JournalEntryDetailsSection';
import { RecurringEntryDetailsSection } from '@/components/molecules/accounting/RecurringEntryDetailsSection';
import { ReversingEntryForm } from '@/components/molecules/accounting/ReversingEntryForm';
import { JournalLinesSection } from '@/components/molecules/accounting/JournalLinesSection';
import { JournalTotalsSection } from '@/components/molecules/accounting/JournalTotalsSection';
import {
  GLAccountCategory,
  JournalEntryFormValues,
  JournalEntryType,
  JournalEntryTypeCode,
  JOURNAL_ENTRY_DEFAULTS,
} from '@/types/accounting';
import { cardClass } from '@/lib/utils';
import {
  useCreateJournal,
  useCreateRecurringJournal,
  useJournal,
  useReverseJournal,
} from '@/hooks';
import { useGLAccounts } from '@/hooks/accounting/useGLAccounts';
import { formatJournalNumber } from '@/lib/formatters';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

// Entry types — will drive which form content is shown.
const ENTRY_TYPE_OPTIONS: { value: JournalEntryType; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'adjusting', label: 'Adjusting Entry' },
  { value: 'reversing', label: 'Reversing Entry' },
  { value: 'closing', label: 'Closing Entry' },
  { value: 'opening', label: 'Opening Balance Entry' },
  { value: 'recurring', label: 'Recurring Entry' },
];

// Revenue and expense accounts start every fiscal year at zero.
const BALANCE_SHEET_CLASSES: GLAccountCategory[] = ['ASSET', 'LIABILITY', 'EQUITY'];

export default function NewJournalEntryPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const base = `/${tenantSlug}/accounting/journalentry`;

  const form = useForm<JournalEntryFormValues>({ defaultValues: JOURNAL_ENTRY_DEFAULTS });
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);

  // "Reverse & correct" lands here with ?correct=<journal id>: load that journal and pre-fill a
  // replacement from its lines, starting from the same entry type unless the user picks another.
  const searchParams = useSearchParams();
  const correctId = searchParams.get('correct') ?? undefined;
  const typeParam = ENTRY_TYPE_OPTIONS.find((o) => o.value === searchParams.get('type'))?.value;
  const { data: correcting } = useJournal(correctId);
  const { data: glAccounts = [] } = useGLAccounts();
  const [chosenType, setEntryType] = useState<JournalEntryType | null>(null);
  const correctingType = correcting?.entryType.toLowerCase() as JournalEntryType | undefined;
  const entryType: JournalEntryType =
    chosenType ??
    typeParam ??
    (correctingType && correctingType !== 'reversing' ? correctingType : 'standard');

  const prefilled = useRef(false);
  useEffect(() => {
    if (!correcting || glAccounts.length === 0 || prefilled.current) return;
    prefilled.current = true;
    const categoryById = new Map(glAccounts.map((a) => [a.id, a.category]));
    form.reset({
      ...JOURNAL_ENTRY_DEFAULTS,
      transactionDate: correcting.transactionDate.slice(0, 10),
      currency: correcting.transactionCurrency,
      exchangeRate: Number(correcting.exchangeRate) === 1 ? '' : Number(correcting.exchangeRate),
      description: correcting.description,
      lines: correcting.lines.map((l) => ({
        accountClass: categoryById.get(l.glAccountId) ?? '',
        targetAccount: l.glAccountId,
        description: l.description ?? '',
        debit: Number(l.transactionDebit) || '',
        credit: Number(l.transactionCredit) || '',
      })),
    });
  }, [correcting, glAccounts, form]);
  const toast = useToast();
  const { mutateAsync: createJournal, isPending: isCreating } = useCreateJournal();
  const { mutateAsync: reverseJournal, isPending: isReversing } = useReverseJournal();
  const { mutateAsync: createRecurring, isPending: isCreatingRecurring } =
    useCreateRecurringJournal();
  const isPending = isCreating || isReversing || isCreatingRecurring;

  const onSubmit = async (data: JournalEntryFormValues) => {
    if (entryType === 'reversing') {
      try {
        const reversal = await reverseJournal({
          id: data.originalJournalId,
          reversalDate: data.reversalDate,
          reason: data.reversalReason.trim(),
        });
        toast.success(`Reversal ${reversal.journalNumber} posted`);
        router.push(base);
      } catch (err) {
        toast.error(extractError(err, 'Failed to reverse journal'));
      }
      return;
    }

    if (entryType !== 'recurring' && !data.fiscalPeriodId) {
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
    // Compare in cents so floating-point sums (0.1 + 0.2) don't fail a balanced entry.
    if (Math.round(debitTotal * 100) !== Math.round(creditTotal * 100)) {
      toast.error('Debit and credit totals must be equal');
      return;
    }

    if (entryType === 'recurring') {
      try {
        await createRecurring({
          name: data.recurringName,
          description: data.description,
          frequency: data.frequency,
          startDate: data.startDate,
          endDate: data.endType === 'ON_DATE' ? data.endDate : null,
          onGeneration: data.onGeneration,
          lines: lines.map((l) => ({
            glAccountId: l.targetAccount,
            description: l.description || undefined,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          })),
        });
        toast.success(`Recurring entry "${data.recurringName}" created`);
        router.push(`${base}/recurring`);
      } catch (err) {
        toast.error(extractError(err, 'Failed to save recurring entry'));
      }
      return;
    }

    try {
      const journal = await createJournal({
        entryType: entryType.toUpperCase() as JournalEntryTypeCode,
        transactionDate: data.transactionDate,
        fiscalPeriodId: data.fiscalPeriodId,
        transactionCurrency: data.currency,
        exchangeRate: data.exchangeRate || undefined,
        description: data.description,
        lines: lines.map((l) => ({
          glAccountId: l.targetAccount,
          description: l.description || undefined,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        })),
      });
      toast.success(`Journal entry ${journal.journalNumber} saved as draft`);
      router.push(base);
    } catch (err) {
      toast.error(extractError(err, 'Failed to save journal entry'));
    }
  };

  return (
    <div className="flex flex-col gap-4 py-6 pr-6 pl-(--page-pl) min-h-0 overflow-y-auto flex-1 *:shrink-0">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Journal Entries
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <span className="text-gray-700 font-medium">New Journal Entry</span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Journal Entry</h1>
          <p className="text-sm text-gray-500">Record a manual journal entry</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-48">
            <SearchSelect
              size="sm"
              placeholder="Entry type"
              options={ENTRY_TYPE_OPTIONS}
              value={entryType}
              onChange={(v) => setEntryType(v as JournalEntryType)}
              clearable={false}
            />
          </div>
          <div className="w-56">
            <FileUpload value={attachment} onChange={setAttachment} />
          </div>
          <Button variant="outline" onClick={() => setShowCancelModal(true)} disabled={isPending}>
            Cancel
          </Button>
          {/* No backend workflow status for "review" yet (JournalStatus is only
              DRAFT/POSTED/REVERSED) — this creates the same draft as "Save as Draft". */}
          <Button
            variant="primary"
            isLoading={isPending}
            loadingText="Saving…"
            onClick={form.handleSubmit(onSubmit)}
          >
            {entryType === 'reversing'
              ? 'Post Reversal'
              : entryType === 'recurring'
                ? 'Save Recurring Entry'
                : 'Submit for Review'}
          </Button>
        </div>
      </div>

      {correcting && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Correcting {formatJournalNumber(correcting.journalNumber)}, which has been reversed. The
          original lines are loaded below — fix them and submit the corrected entry.
        </div>
      )}

      {entryType === 'reversing' ? (
        <ReversingEntryForm form={form} />
      ) : (
        <>
          <div className={cardClass('p-4')}>
            {entryType === 'recurring' ? (
              <RecurringEntryDetailsSection form={form} />
            ) : (
              <JournalEntryDetailsSection form={form} entryType={entryType} />
            )}
          </div>

          <JournalLinesSection
            form={form}
            allowedClasses={entryType === 'opening' ? BALANCE_SHEET_CLASSES : undefined}
          />

          <JournalTotalsSection form={form} />
        </>
      )}

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
            <Button variant="danger" onClick={() => router.push(base)}>
              Yes, Cancel
            </Button>
          </>
        }
      />
    </div>
  );
}
