'use client';

import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import {
  useCreateTenantDomain,
  useDeleteTenantDomain,
  useRegenerateTenantDomainVerification,
  useTenantDomains,
  useVerifyTenantDomain,
} from '@/hooks/marketing/useSmsMarketing';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { formatDate } from '@/lib/formatters';
import type { TenantDomain } from '@/types/marketing';

const STATUS_VARIANT = {
  VERIFIED: 'success',
  UNVERIFIED: 'warning',
  REJECTED: 'danger',
} as const;

export default function BusinessDomainsPage() {
  const toast = useToast();
  const canCreate = usePermissionRule('marketing.domains:CREATE');
  const canVerify = usePermissionRule('marketing.domains:VERIFY');
  const canDelete = usePermissionRule('marketing.domains:DELETE');
  const { data: domains = [], isLoading, isError } = useTenantDomains();
  const createDomain = useCreateTenantDomain();
  const verifyDomain = useVerifyTenantDomain();
  const regenerate = useRegenerateTenantDomainVerification();
  const deleteDomain = useDeleteTenantDomain();
  const [domain, setDomain] = useState('');

  function handleCreate() {
    const value = domain.trim();
    if (!value) return;
    createDomain.mutate(
      { domain: value },
      {
        onSuccess: () => {
          toast.success('Business domain registered');
          setDomain('');
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to register domain')),
      },
    );
  }

  function copy(value: string, label: string) {
    void navigator.clipboard?.writeText(value).then(
      () => toast.success(`${label} copied`),
      () => toast.error(`Could not copy ${label.toLowerCase()}`),
    );
  }

  function handleVerify(item: TenantDomain) {
    verifyDomain.mutate(item.id, {
      onSuccess: (result) =>
        result.verified
          ? toast.success('Domain verified')
          : toast.error(result.reason ?? 'DNS record not found yet'),
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to verify domain')),
    });
  }

  function handleRegenerate(item: TenantDomain) {
    regenerate.mutate(item.id, {
      onSuccess: () => toast.success('Verification record regenerated'),
      onError: (error) =>
        toast.error(apiErrorMessage(error, 'Failed to regenerate verification record')),
    });
  }

  function handleDelete(item: TenantDomain) {
    deleteDomain.mutate(item.id, {
      onSuccess: () => toast.success('Business domain deleted'),
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to delete domain')),
    });
  }

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-gray-400">Loading domains...</p>;
  }

  if (isError) {
    return <p className="py-8 text-center text-sm text-red-500">Failed to load domains.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-72 flex-1">
            <Input
              label="Business domain"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="example.com"
              disabled={!canCreate}
            />
          </div>
          {canCreate && (
            <Button onClick={handleCreate} isLoading={createDomain.isPending}>
              Register Domain
            </Button>
          )}
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Add a domain your company controls. WorkPhelo verifies ownership with a DNS TXT record
          before it can be used as communication identity evidence.
        </p>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-gray-950">Business Domains</h2>
          <p className="text-sm text-gray-500">
            DNS verification proves that this tenant controls the business domain.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {domains.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">
              No business domains registered yet.
            </p>
          ) : (
            domains.map((item) => (
              <div key={item.id} className="flex flex-col gap-4 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-950">{item.domain}</p>
                      <Badge
                        label={item.ownershipStatus.toLowerCase()}
                        variant={STATUS_VARIANT[item.ownershipStatus]}
                      />
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      Verified: {item.verifiedAt ? formatDate(item.verifiedAt) : 'Not verified'} ·
                      Last checked: {item.lastCheckedAt ? formatDate(item.lastCheckedAt) : 'Never'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canVerify && item.ownershipStatus !== 'VERIFIED' && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => handleVerify(item)}
                          isLoading={verifyDomain.isPending}
                        >
                          Verify
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleRegenerate(item)}
                          isLoading={regenerate.isPending}
                        >
                          Regenerate
                        </Button>
                      </>
                    )}
                    {canDelete && (
                      <Button
                        variant="danger"
                        onClick={() => handleDelete(item)}
                        isLoading={deleteDomain.isPending}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                {item.ownershipStatus !== 'VERIFIED' && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                      DNS TXT record
                    </p>
                    <div className="mt-3 grid gap-3 lg:grid-cols-[120px_1fr_auto]">
                      <p className="text-sm font-semibold text-gray-700">Type</p>
                      <code className="rounded-lg bg-white px-3 py-2 text-sm text-gray-700">
                        {item.verificationRecord.type}
                      </code>
                      <span />
                      <p className="text-sm font-semibold text-gray-700">Host</p>
                      <code className="break-all rounded-lg bg-white px-3 py-2 text-sm text-gray-700">
                        {item.verificationRecord.host}
                      </code>
                      <Button
                        variant="outline"
                        onClick={() => copy(item.verificationRecord.host, 'Host')}
                      >
                        Copy Host
                      </Button>
                      <p className="text-sm font-semibold text-gray-700">Value</p>
                      <code className="break-all rounded-lg bg-white px-3 py-2 text-sm text-gray-700">
                        {item.verificationRecord.value}
                      </code>
                      <Button
                        variant="outline"
                        onClick={() => copy(item.verificationRecord.value, 'Value')}
                      >
                        Copy Value
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
