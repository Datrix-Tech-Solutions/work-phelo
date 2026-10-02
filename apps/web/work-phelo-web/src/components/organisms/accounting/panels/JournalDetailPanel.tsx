'use client';

import { Fragment, useState, ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Input } from '@/components/atoms/Input';
import {
  ADJUSTMENT_CATEGORY_OPTIONS,
  JOURNAL_ENTRY_TYPE_LABELS,
  JournalEntryRecord,
  JournalRecordStatus,
} from '@/types/accounting';
import { useFiscalPeriods, usePostJournal, useReverseJournal } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { formatSourceEventDescription } from '@/config/reinsurance-event-catalog';
import { formatJournalNumber } from '@/lib/formatters';
import { canReverse, displayStatus } from '@/lib/accounting/journalStatus';
import { JOURNAL_SOURCE_LABELS, describeJournalSource } from '@/lib/accounting/journalSource';

interface JournalDetailPanelProps {
  journal: JournalEntryRecord | null;
  onClose: () => void;
}

const STATUS_VARIANT: Record<JournalRecordStatus, 'success' | 'neutral' | 'danger'> = {
  DRAFT: 'neutral',
  POSTED: 'success',
  REVERSED: 'danger',
};

function fmtAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

export function JournalDetailPanel({ journal, onClose }: JournalDetailPanelProps) {
  const toast = useToast();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  // 'reverse' just cancels the journal; 'correct' also opens a pre-filled replacement afterwards.
  const [reverseMode, setReverseMode] = useState<'reverse' | 'correct' | null>(null);
  const [reversalDate, setReversalDate] = useState('');
  const [reason, setReason] = useState('');

  const { data: fiscalPeriods = [] } = useFiscalPeriods();
  const fiscalPeriodName =
    fiscalPeriods.find((p) => p.id === journal?.fiscalPeriodId)?.name ?? journal?.fiscalPeriodId;

  const postJournal = usePostJournal();
  const reverseJournal = useReverseJournal();

  // Debit and credit always match on a saved journal, so one total covers both sides.
  const debitTotal =
    journal?.lines.reduce((sum, line) => sum + Number(line.transactionDebit), 0) ?? 0;

  // The reversal cannot be dated before the original, and today is the natural default.
  const openReverse = (mode: 'reverse' | 'correct') => {
    if (!journal) return;
    const today = new Date().toISOString().slice(0, 10);
    const originalDate = journal.transactionDate.slice(0, 10);
    setReversalDate(today > originalDate ? today : originalDate);
    setReverseMode(mode);
  };

  const handleClose = () => {
    setReverseMode(null);
    setReason('');
    onClose();
  };

  const handlePost = async () => {
    if (!journal) return;
    try {
      await postJournal.mutateAsync(journal.id);
      toast.success('Journal posted.');
    } catch (err) {
      toast.error(extractError(err, 'Failed to post journal'));
    }
  };

  const handleReverse = async () => {
    if (!journal) return;
    if (!reason.trim()) {
      toast.error('A reversal reason is required.');
      return;
    }
    try {
      const reversal = await reverseJournal.mutateAsync({
        id: journal.id,
        reversalDate,
        reason: reason.trim(),
      });
      toast.success(`Journal reversed by ${formatJournalNumber(reversal.journalNumber)}.`);
      const correctId = reverseMode === 'correct' ? journal.id : null;
      handleClose();
      if (correctId) {
        router.push(`/${tenantSlug}/accounting/journalentry/new?correct=${correctId}`);
      }
    } catch (err) {
      toast.error(extractError(err, 'Failed to reverse journal'));
    }
  };

  return (
    <>
      <SidePanel
        isOpen={!!journal}
        onClose={handleClose}
        title={journal ? formatJournalNumber(journal.journalNumber) : 'Journal'}
        description={journal ? formatSourceEventDescription(journal.description) : undefined}
        footer={
          journal?.status === 'DRAFT' ? (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button isLoading={postJournal.isPending} loadingText="Posting…" onClick={handlePost}>
                Post
              </Button>
            </div>
          ) : journal && canReverse(journal) ? (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button variant="outline" onClick={() => openReverse('correct')}>
                Reverse &amp; correct
              </Button>
              <Button variant="danger" onClick={() => openReverse('reverse')}>
                Reverse
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </div>
          )
        }
      >
        {journal && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Badge
                label={displayStatus(journal)}
                variant={STATUS_VARIANT[displayStatus(journal)]}
              />
              {journal.reference && (
                <span className="text-xs text-gray-500">Ref: {journal.reference}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Journal Type" value={JOURNAL_ENTRY_TYPE_LABELS[journal.entryType]} />
              {journal.adjustmentCategory && (
                <Field
                  label="Adjustment Category"
                  value={
                    ADJUSTMENT_CATEGORY_OPTIONS.find(
                      (o) => o.value.toUpperCase() === journal.adjustmentCategory,
                    )?.label ?? journal.adjustmentCategory
                  }
                />
              )}
              {journal.source && (
                <Field
                  label="Source"
                  value={`${JOURNAL_SOURCE_LABELS[journal.source.category]} · ${describeJournalSource(journal.source)}`}
                />
              )}
              <Field label="Transaction Date" value={fmtDate(journal.transactionDate)} />
              <Field label="Posting Date" value={fmtDate(journal.postingDate)} />
              <Field label="Fiscal Period" value={fiscalPeriodName ?? '—'} />
              <Field
                label="Currency"
                value={
                  journal.transactionCurrency === journal.baseCurrency
                    ? journal.transactionCurrency
                    : `${journal.transactionCurrency} (base ${journal.baseCurrency} @ ${journal.exchangeRate})`
                }
              />
            </div>

            <div className="rounded-xl border border-gray-200 p-3 flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-500">Lines</span>
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 text-sm">
                <span className="text-gray-500 text-xs font-medium">Account</span>
                <span className="text-gray-500 text-xs font-medium">Side</span>
                <span className="text-gray-500 text-xs font-medium text-right">Amount</span>

                {journal.lines.map((line) => {
                  const isDebit = Number(line.transactionDebit) > 0;
                  const amount = isDebit
                    ? Number(line.transactionDebit)
                    : Number(line.transactionCredit);
                  return (
                    <Fragment key={line.id}>
                      <span className="text-gray-900">
                        {line.glAccount.code} – {line.glAccount.name}
                        {line.subledgerAccount && (
                          <span className="block text-xs text-gray-400">
                            {line.subledgerAccount.code} {line.subledgerAccount.name}
                          </span>
                        )}
                        {line.description && (
                          <span className="block text-xs text-gray-400">
                            {formatSourceEventDescription(line.description)}
                          </span>
                        )}
                      </span>
                      <span className="text-gray-700">{isDebit ? 'Debit' : 'Credit'}</span>
                      <span className="text-right text-gray-900">
                        {fmtAmount(amount, journal.transactionCurrency)}
                      </span>
                    </Fragment>
                  );
                })}

                <span className="text-gray-500 text-xs font-medium pt-1 border-t border-gray-100">
                  Total
                </span>
                <span className="pt-1 border-t border-gray-100" />
                <span className="text-right font-semibold text-gray-900 pt-1 border-t border-gray-100">
                  {fmtAmount(debitTotal, journal.transactionCurrency)}
                </span>
              </div>
            </div>

            {journal.reversalOfJournal && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                This journal reverses {formatJournalNumber(journal.reversalOfJournal.journalNumber)}
                .
              </div>
            )}
            {journal.reversalJournal && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Reversed by {formatJournalNumber(journal.reversalJournal.journalNumber)} on{' '}
                {fmtDate(journal.reversalJournal.transactionDate)}. The original entry is unchanged.
              </div>
            )}
          </div>
        )}
      </SidePanel>

      <Modal
        isOpen={reverseMode !== null}
        onClose={() => setReverseMode(null)}
        title={reverseMode === 'correct' ? 'Reverse & Correct Journal' : 'Reverse Journal'}
        description={
          reverseMode === 'correct'
            ? 'Posts a linked reversal, then opens a new journal pre-filled with the original lines for you to correct. The original is not edited.'
            : 'Creates an exact linked reversal. The original posted journal is not edited.'
        }
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setReverseMode(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={reverseJournal.isPending}
              loadingText="Reversing…"
              onClick={handleReverse}
            >
              {reverseMode === 'correct' ? 'Reverse & Correct' : 'Reverse Journal'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Reversal Date"
            type="date"
            value={reversalDate}
            onChange={(e) => setReversalDate(e.target.value)}
          />
          <Input
            label="Reason"
            type="textarea"
            rows={3}
            value={reason}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
            placeholder="e.g. Correction approved by finance"
          />
        </div>
      </Modal>
    </>
  );
}
