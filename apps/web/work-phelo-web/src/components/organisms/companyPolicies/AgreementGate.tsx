'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMyCompanyAgreements, useSignMyAgreement } from '@/hooks';
import { useLogout } from '@/hooks/useAuth';
import { Button } from '@/components/atoms/Button';
import { inputClass } from '@/lib/utils';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

const AGREEMENT_TYPE_LABELS: Record<string, string> = {
  NDA: 'Non-Disclosure Agreement',
  EMPLOYMENT_CONTRACT: 'Employment Contract',
  CONFIDENTIALITY: 'Confidentiality Agreement',
  NON_COMPETE: 'Non-Compete Agreement',
  CODE_OF_CONDUCT: 'Code of Conduct',
  IP_ASSIGNMENT: 'IP Assignment Agreement',
  PROBATION_AGREEMENT: 'Probation Agreement',
  OTHER: 'Agreement',
};

interface Props {
  tenantSlug: string;
}

export function AgreementGate({ tenantSlug }: Props) {
  const router = useRouter();
  const { data: agreements, isLoading } = useMyCompanyAgreements();
  const { mutate: sign, isPending: isSigning } = useSignMyAgreement();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  const [typedName, setTypedName] = useState('');

  const pending = (agreements ?? []).filter(
    (a) => a.status === 'PENDING' && a.agreement.isRequired,
  );
  const current = pending[0] ?? null;

  if (isLoading || !current) return null;

  const typeLabel = AGREEMENT_TYPE_LABELS[current.agreement.type] ?? 'Agreement';
  const total = pending.length;

  const handleAccept = () => {
    if (!typedName.trim()) {
      useToastStore
        .getState()
        .addToast({ message: 'Please type your full name to accept', type: 'error' });
      return;
    }
    sign(
      { versionId: current.version.id, typedName: typedName.trim() },
      {
        onSuccess: () => setTypedName(''),
        onError: (err) =>
          useToastStore
            .getState()
            .addToast({ message: extractError(err, 'Failed to sign agreement'), type: 'error' }),
      },
    );
  };

  const handleDecline = () => {
    logout(undefined, {
      onSettled: () => router.replace(`/${tenantSlug}/login`),
    });
  };

  const isSubmitting = isSigning || isLoggingOut;

  return (
    <div className="fixed inset-0 z-50 bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {typeLabel}
            </p>
            {total > 1 && (
              <span className="text-xs text-gray-400">
                {total} agreement{total !== 1 ? 's' : ''} remaining
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900">{current.version.title}</h1>
        </div>

        <div className="rounded-xl border border-gray-200 p-5 max-h-[45vh] overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {current.version.details}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-gray-900">Type your full name to accept</label>
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Your full legal name"
            disabled={isSubmitting}
            className={inputClass()}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="danger"
            onClick={handleDecline}
            disabled={isSubmitting}
            isLoading={isLoggingOut}
            loadingText="Logging out…"
          >
            Decline
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isSubmitting}
            isLoading={isSigning}
            loadingText="Accepting…"
          >
            Accept
          </Button>
        </div>

        <p className="text-xs text-gray-400">
          By accepting, you confirm that you have read and agree to be bound by this agreement.
          Declining will log you out of the system.
        </p>
      </div>
    </div>
  );
}
