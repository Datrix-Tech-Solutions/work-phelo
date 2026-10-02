'use client';

import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useFiscalPeriodCloseCheck } from '@/hooks';
import { CloseCheckItem, FiscalPeriod } from '@/types/accounting';

export type ClosePeriodAction = 'soft-close' | 'close';

interface ClosePeriodModalProps {
  period: FiscalPeriod | null;
  action: ClosePeriodAction;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function CheckList({
  title,
  items,
  tone,
}: {
  title: string;
  items: CloseCheckItem[];
  tone: 'blocker' | 'warning';
}) {
  const Icon = tone === 'blocker' ? Icons.CircleX : Icons.FileWarning;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</span>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.code} className="flex items-start gap-2 text-sm text-gray-800">
            <Icon
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                tone === 'blocker' ? 'text-red-500' : 'text-amber-500'
              }`}
            />
            <span>{item.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Confirms soft closing / closing a period. An open period first shows the pre-close check —
 * blockers must be cleared before the period can leave Open, warnings never stop it. A
 * soft-closed period already passed that check, so closing it is a plain confirmation.
 */
export function ClosePeriodModal({
  period,
  action,
  isSubmitting,
  onClose,
  onConfirm,
}: ClosePeriodModalProps) {
  const needsCheck = period?.status === 'OPEN';
  const {
    data: check,
    isLoading,
    isError,
  } = useFiscalPeriodCloseCheck(needsCheck ? period.id : undefined);

  const isSoft = action === 'soft-close';
  const canConfirm = !needsCheck || (!!check && check.canClose);

  return (
    <Modal
      isOpen={!!period}
      onClose={onClose}
      title={isSoft ? 'Soft Close Period' : 'Close Period'}
      description={
        isSoft
          ? `Soft close "${period?.name}"? It stops accepting new entries while you review it, and can be reopened.`
          : `Close "${period?.name}"? No further entries can be posted to it. It can still be reopened later.`
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={isSoft ? undefined : 'danger'}
            isLoading={isSubmitting}
            loadingText={isSoft ? 'Soft closing…' : 'Closing…'}
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            {isSoft ? 'Soft Close' : 'Close'}
          </Button>
        </div>
      }
    >
      {needsCheck && (
        <div className="flex flex-col gap-4">
          {isLoading ? (
            <>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-2/3" />
            </>
          ) : isError || !check ? (
            <p className="text-sm text-red-600">
              Couldn&apos;t run the pre-close check. Close this dialog and try again.
            </p>
          ) : (
            <>
              {check.blockers.length > 0 && (
                <CheckList title="Fix these first" items={check.blockers} tone="blocker" />
              )}
              {check.warnings.length > 0 && (
                <CheckList title="Worth a look" items={check.warnings} tone="warning" />
              )}
              {check.blockers.length === 0 && check.warnings.length === 0 && (
                <p className="flex items-center gap-2 text-sm text-green-700">
                  <Icons.CircleCheck className="h-4 w-4" />
                  Nothing is holding this period open.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
