'use client';

import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  useFulfillTenantSmsCreditRequest,
  useGrantTenantSmsCredits,
  useRejectTenantSmsCreditRequest,
  useTenantSmsCreditRequests,
  useTenantSmsLedger,
  useTenantSmsWalletBalance,
  type SmsLedgerEntryType,
} from '@/hooks/marketing/useTenantSmsConfig';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import type { SmsCreditRequest } from '@/types/marketing';

const MAX_GRANT = 1_000_000;

const LEDGER_LABELS: Record<SmsLedgerEntryType, string> = {
  INITIAL_ALLOCATION: 'Initial allocation',
  PLAN_ALLOCATION: 'Plan allocation',
  PURCHASE: 'Purchase',
  ADMIN_GRANT: 'Admin grant',
  PROMOTIONAL: 'Promotional',
  CAMPAIGN_RESERVATION: 'Campaign reservation',
  CAMPAIGN_CONSUMPTION: 'Campaign usage',
  CAMPAIGN_RELEASE: 'Campaign release',
  CAMPAIGN_REFUND: 'Campaign refund',
  ADMIN_ADJUSTMENT: 'Admin adjustment',
};

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">
        {value === undefined ? '—' : value.toLocaleString()}
      </p>
    </div>
  );
}

export function TenantSmsWallet({ tenantId }: { tenantId: string }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data: wallet, isLoading, isError } = useTenantSmsWalletBalance(tenantId);
  const { data: ledger, isFetching: ledgerFetching } = useTenantSmsLedger(tenantId, page);
  const grant = useGrantTenantSmsCredits(tenantId);
  const { data: creditRequests = [] } = useTenantSmsCreditRequests(tenantId);
  const fulfill = useFulfillTenantSmsCreditRequest(tenantId);
  const reject = useRejectTenantSmsCreditRequest(tenantId);

  const [fulfilling, setFulfilling] = useState<SmsCreditRequest | null>(null);
  const [fulfillCredits, setFulfillCredits] = useState('');
  const [rejecting, setRejecting] = useState<SmsCreditRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fulfillAmount = Number(fulfillCredits);
  const validFulfillAmount =
    Number.isInteger(fulfillAmount) && fulfillAmount >= 1 && fulfillAmount <= MAX_GRANT;
  const pendingRequests = creditRequests.filter((request) => request.status === 'PENDING');
  const pastRequests = creditRequests.filter((request) => request.status !== 'PENDING');

  function openFulfill(request: SmsCreditRequest) {
    setFulfilling(request);
    setFulfillCredits(String(request.requestedCredits));
  }

  function handleFulfill() {
    if (!fulfilling || !validFulfillAmount) return;
    fulfill.mutate(
      {
        id: fulfilling.id,
        ...(fulfillAmount !== fulfilling.requestedCredits ? { credits: fulfillAmount } : {}),
      },
      {
        onSuccess: () => {
          toast.success(`${fulfillAmount.toLocaleString()} SMS credits granted`);
          setFulfilling(null);
          setPage(1);
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to fulfil the request')),
      },
    );
  }

  function handleReject() {
    if (!rejecting) return;
    reject.mutate(
      { id: rejecting.id, ...(rejectReason.trim() ? { reason: rejectReason.trim() } : {}) },
      {
        onSuccess: () => {
          toast.success('Credit request rejected');
          setRejecting(null);
          setRejectReason('');
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to reject the request')),
      },
    );
  }

  const [grantOpen, setGrantOpen] = useState(false);
  const [credits, setCredits] = useState('');
  const [reason, setReason] = useState('');
  // One key per dialog opening, so a retry after a dropped response can't grant twice.
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const amount = Number(credits);
  const validAmount = Number.isInteger(amount) && amount >= 1 && amount <= MAX_GRANT;

  function openGrant() {
    setCredits('');
    setReason('');
    setIdempotencyKey(crypto.randomUUID());
    setGrantOpen(true);
  }

  function handleGrant() {
    if (!validAmount) return;
    grant.mutate(
      { credits: amount, idempotencyKey, ...(reason.trim() ? { reason: reason.trim() } : {}) },
      {
        onSuccess: () => {
          toast.success(`${amount.toLocaleString()} SMS credits granted`);
          setGrantOpen(false);
          setPage(1);
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to grant credits')),
      },
    );
  }

  const entries = ledger?.data ?? [];
  const meta = ledger?.meta;

  return (
    <section className="rounded-card border border-gray-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">SMS Wallet</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Campaigns reserve credits when they are sent and release any that go unused.
          </p>
        </div>
        <Button size="sm" onClick={openGrant}>
          Grant Credits
        </Button>
      </div>

      {isError ? (
        <p className="px-5 py-8 text-center text-sm text-red-500">Failed to load the wallet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4 border-b border-gray-100 px-5 py-4">
          <Stat label="Available" value={isLoading ? undefined : wallet?.availableCredits} />
          <Stat label="Reserved" value={isLoading ? undefined : wallet?.reservedCredits} />
          <Stat label="Total" value={isLoading ? undefined : wallet?.totalCredits} />
        </div>
      )}

      {creditRequests.length > 0 && (
        <div className="border-b border-gray-100 px-5 py-4">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Credit requests
          </h4>
          <ul className="mt-2 divide-y divide-gray-50">
            {[...pendingRequests, ...pastRequests.slice(0, 5)].map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {request.requestedCredits.toLocaleString()} credits
                    {request.status === 'FULFILLED' &&
                    request.grantedCredits !== request.requestedCredits
                      ? ` (${request.grantedCredits?.toLocaleString()} granted)`
                      : ''}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(request.requestedAt).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {request.note ? ` · ${request.note}` : ''}
                    {request.rejectionReason ? ` · Rejected: ${request.rejectionReason}` : ''}
                  </p>
                </div>
                {request.status === 'PENDING' ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setRejecting(request)}>
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => openFulfill(request)}>
                      Fulfil
                    </Button>
                  </div>
                ) : (
                  <Badge
                    label={request.status.toLowerCase()}
                    variant={request.status === 'FULFILLED' ? 'success' : 'danger'}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-5 py-4">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Credit history
        </h4>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            {ledgerFetching ? 'Loading history…' : 'No credit activity yet.'}
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 text-right font-medium">Credits</th>
                  <th className="py-2 pr-4 text-right font-medium">Available after</th>
                  <th className="py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap py-2 pr-4 text-gray-600">
                      {new Date(entry.createdAt).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2 pr-4 text-gray-900">{LEDGER_LABELS[entry.type]}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-gray-900">
                      {entry.credits.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-gray-600">
                      {entry.availableAfter.toLocaleString()}
                    </td>
                    <td className="py-2 text-gray-500">{entry.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
            <span>
              Page {meta.page} of {meta.totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={Boolean(fulfilling)}
        onClose={() => setFulfilling(null)}
        title="Fulfil Credit Request"
        description={`They asked for ${fulfilling?.requestedCredits.toLocaleString() ?? ''} credits. You can grant a different amount.`}
        width="max-w-sm"
        height="max-h-fit"
        footer={
          <>
            <Button variant="outline" onClick={() => setFulfilling(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleFulfill}
              isLoading={fulfill.isPending}
              disabled={!validFulfillAmount}
            >
              Grant
            </Button>
          </>
        }
      >
        <Input
          label="Credits to grant"
          type="number"
          min={1}
          max={MAX_GRANT}
          value={fulfillCredits}
          onChange={(e) => setFulfillCredits(e.target.value)}
          error={
            fulfillCredits && !validFulfillAmount
              ? `Enter a whole number from 1 to ${MAX_GRANT.toLocaleString()}`
              : undefined
          }
        />
      </Modal>

      <Modal
        isOpen={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Reject Credit Request"
        description="The reason is shown to the company."
        width="max-w-sm"
        height="max-h-fit"
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleReject} isLoading={reject.isPending}>
              Reject
            </Button>
          </>
        }
      >
        <Input
          label="Reason (optional)"
          value={rejectReason}
          maxLength={300}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="eg; Payment not received"
        />
      </Modal>

      <Modal
        isOpen={grantOpen}
        onClose={() => setGrantOpen(false)}
        title="Grant SMS Credits"
        description="Credits are added to this company's available balance straight away."
        width="max-w-sm"
        height="max-h-fit"
        footer={
          <>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGrant} isLoading={grant.isPending} disabled={!validAmount}>
              Grant
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Credits"
            type="number"
            min={1}
            max={MAX_GRANT}
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            placeholder="eg; 1000"
            error={
              credits && !validAmount
                ? `Enter a whole number from 1 to ${MAX_GRANT.toLocaleString()}`
                : undefined
            }
          />
          <Input
            label="Reason (optional)"
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            placeholder="eg; Onboarding allocation"
          />
        </div>
      </Modal>
    </section>
  );
}
