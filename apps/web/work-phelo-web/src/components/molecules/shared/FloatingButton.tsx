'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Modal } from '@/components/organisms/shared/Modal';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { NewTransactionPanel } from '@/components/organisms/accounting/panels/NewTransactionPanel';
import { useTransactionTypes } from '@/hooks/accounting/useTransactionTypes';
import { useReviewLeaveRequest } from '@/hooks/hr/useLeave';
import { useReviewShiftSwap } from '@/hooks/hr/useScheduling';
import { useReviewCorrectionRequest } from '@/hooks/hr/useTimeClock';
import { useReminders, type Reminder } from '@/hooks/useReminders';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { useAuthStore } from '@/store/auth.store';
import { useToastStore } from '@/store/toast.store';

type PanelTab = 'reminders' | 'feedback';

function RemindersTab({
  reminders,
  onReview,
}: {
  reminders: Reminder[];
  onReview: (id: string) => void;
}) {
  if (reminders.length === 0) return <p className="p-4 text-sm text-gray-500">All clear.</p>;

  return (
    <ul className="divide-y divide-gray-100">
      {reminders.map((reminder) => (
        <li key={reminder.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
              {reminder.kind}
            </span>
            <span className="truncate text-sm font-semibold text-gray-900">{reminder.title}</span>
            {reminder.detail && (
              <span className="truncate text-xs text-gray-500">{reminder.detail}</span>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => onReview(reminder.id)}>
            Review
          </Button>
        </li>
      ))}
    </ul>
  );
}

function ReminderModal({
  reminder,
  onClose,
  onPayTax,
}: {
  reminder: Reminder | null;
  onClose: () => void;
  onPayTax: (taxTypeId: string) => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<'approve' | 'reject' | null>(null);

  const reviewLeave = useReviewLeaveRequest();
  const reviewCorrection = useReviewCorrectionRequest();
  const reviewSwap = useReviewShiftSwap();

  const close = () => {
    if (deciding) return;
    setNote('');
    setNoteError(null);
    onClose();
  };

  const decide = async (action: 'approve' | 'reject') => {
    const review = reminder?.review;
    if (!reminder || !review) return;

    const text = note.trim();
    // A swap can't be turned down without telling both employees why.
    if (review.type === 'swap' && action === 'reject' && !text) {
      setNoteError('A rejection reason is required');
      return;
    }

    setNoteError(null);
    setDeciding(action);
    try {
      if (!reminder.dummy) {
        const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
        if (review.type === 'leave') {
          await reviewLeave.mutateAsync({ id: review.id, action: status, note: text || undefined });
        } else if (review.type === 'correction') {
          await reviewCorrection.mutateAsync({
            id: review.id,
            action: status,
            note: text || undefined,
          });
        } else {
          await reviewSwap.mutateAsync({
            shiftSwapId: review.id,
            payload:
              action === 'approve' ? { action: 'APPROVE' } : { action: 'REJECT', reason: text },
          });
        }
      }
      toast.success(`${reminder.kind} ${action === 'approve' ? 'approved' : 'rejected'}`);
      setDeciding(null);
      setNote('');
      onClose();
    } catch (err) {
      toast.error(extractError(err, 'Something went wrong'));
      setDeciding(null);
    }
  };

  const review = reminder?.review;
  const noteLabel =
    review?.type === 'swap' ? 'Reason (required to reject)' : 'Note for employee (optional)';

  return (
    <Modal
      isOpen={!!reminder}
      onClose={close}
      title={reminder?.kind ?? ''}
      description={reminder ? `Submitted by ${reminder.title}` : undefined}
      footer={
        review ? (
          <>
            <Button
              variant="danger"
              onClick={() => decide('reject')}
              isLoading={deciding === 'reject'}
              loadingText="Rejecting..."
              disabled={deciding === 'approve'}
            >
              Reject
            </Button>
            <Button
              onClick={() => decide('approve')}
              isLoading={deciding === 'approve'}
              loadingText="Approving..."
              disabled={deciding === 'reject'}
            >
              Approve
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Close
            </Button>
            {reminder?.payTax && (
              <Button
                onClick={() => {
                  const taxTypeId = reminder.payTax;
                  if (!taxTypeId) return;
                  close();
                  onPayTax(taxTypeId);
                }}
              >
                Pay now
              </Button>
            )}
          </>
        )
      }
    >
      {reminder && (
        <div className="mt-4 flex flex-col gap-4">
          {reminder.fields && reminder.fields.length > 0 ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              {reminder.fields.map((field) => (
                <div key={field.label} className="flex flex-col gap-0.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    {field.label}
                  </dt>
                  <dd className="text-sm text-gray-900">{field.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            reminder.detail && <p className="text-sm text-gray-500">{reminder.detail}</p>
          )}
          {review && (
            <Input
              type="textarea"
              label={noteLabel}
              rows={3}
              value={note}
              error={noteError ?? undefined}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
              placeholder="Add a note..."
            />
          )}
        </div>
      )}
    </Modal>
  );
}

function FeedbackTab() {
  const [message, setMessage] = useState('');

  return (
    <div className="flex flex-col gap-3 p-4">
      <Input
        type="textarea"
        label="Your feedback"
        rows={5}
        value={message}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
        placeholder="Tell us what you think"
      />
      {/* Nothing receives feedback yet, so sending stays off until there is somewhere to send it. */}
      <Button size="sm" disabled>
        Send
      </Button>
    </div>
  );
}

export function FloatingButton() {
  const user = useAuthStore((s) => s.user);
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>('reminders');

  const toast = useToast();
  const reminders = useReminders();
  const reminderCount = reminders.length;
  const [reviewId, setReviewId] = useState<string | null>(null);
  // The payment form for a tax is opened right here, so nobody is taken to the transactions page.
  const [payingTaxId, setPayingTaxId] = useState<string | null>(null);
  const { data: transactionTypes, isSuccess: transactionTypesLoaded } = useTransactionTypes({
    enabled: !!payingTaxId,
  });
  const paymentType =
    transactionTypes?.find(
      (t) =>
        t.postsToCashbook &&
        t.category === 'PAYABLE' &&
        !t.sourceTypeId &&
        !t.isLinked &&
        t.code === 'PMNT',
    ) ??
    transactionTypes?.find(
      (t) => t.postsToCashbook && t.category === 'PAYABLE' && !t.sourceTypeId && !t.isLinked,
    );

  // The standard payment type is created for the tenant on first read; if there is none to use, say so.
  const noPaymentType = !!payingTaxId && transactionTypesLoaded && !paymentType;
  useEffect(() => {
    if (noPaymentType) {
      useToastStore.getState().addToast({
        type: 'error',
        message: 'There is no direct payment type to pay this tax with',
      });
    }
  }, [noPaymentType]);
  const payTax = (taxTypeId: string) => {
    // Already known to have none: say so now, since nothing would change to trigger the message above.
    if (transactionTypesLoaded && !paymentType) {
      toast.error('There is no direct payment type to pay this tax with');
      return;
    }
    setPayingTaxId(taxTypeId);
  };

  if (!user) return null;

  const tabs = [
    { key: 'reminders', label: 'Reminders', count: reminderCount },
    { key: 'feedback', label: 'Feedback' },
  ];

  return (
    <>
      {isOpen && (
        <div
          role="dialog"
          aria-label="Reminders and feedback"
          className="fixed bottom-20 right-4 z-40 flex max-h-112 w-80 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          <TabBar
            tabs={tabs}
            activeTab={tab}
            onTabChange={(key) => setTab(key as PanelTab)}
            className="[--tab-first-pl:1rem]"
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'reminders' ? (
              <RemindersTab reminders={reminders} onReview={setReviewId} />
            ) : (
              <FeedbackTab />
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        aria-label={isOpen ? 'Close panel' : 'Open reminders and feedback'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-(--glass-border,rgba(255,255,255,0.55)) bg-(--module-btn-bg,var(--color-brand)) text-white shadow-lg transition hover:scale-110 hover:bg-(--module-btn-bg-hover,var(--color-brand-hover)) active:scale-95 focus:outline-none focus:ring-2 focus:ring-(--module-btn-bg,var(--color-brand)) focus:ring-offset-2"
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
        {!isOpen && reminderCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
            {reminderCount > 99 ? '99+' : reminderCount}
          </span>
        )}
      </button>
      <ReminderModal
        reminder={reminders.find((r) => r.id === reviewId) ?? null}
        onClose={() => setReviewId(null)}
        onPayTax={payTax}
      />
      <NewTransactionPanel
        transactionType={payingTaxId ? paymentType : undefined}
        taxToPay={payingTaxId ?? undefined}
        onClose={() => setPayingTaxId(null)}
      />
    </>
  );
}
