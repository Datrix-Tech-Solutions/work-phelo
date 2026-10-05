'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Modal } from '@/components/organisms/shared/Modal';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import {
  useArchiveSmsSenderIdentity,
  useCreateSmsSenderIdentity,
  useSetDefaultSmsSenderIdentity,
  useSmsSenderIdentities,
  useSmsWalletBalance,
  useSubmitSmsSenderIdentity,
} from '@/hooks/marketing/useSmsMarketing';
import { apiErrorMessage } from '@/lib/apiError';
import { useToast } from '@/hooks/useToast';

interface SenderForm {
  senderId: string;
  displayName: string;
}

const EMPTY_FORM: SenderForm = { senderId: '', displayName: '' };

export default function SmsSendersPage() {
  const toast = useToast();
  const canCreate = usePermissionRule('marketing.sms-sender-identities:CREATE');
  const canEdit = usePermissionRule('marketing.sms-sender-identities:EDIT');
  const canDelete = usePermissionRule('marketing.sms-sender-identities:DELETE');
  const canSubmit = usePermissionRule('marketing.sms-sender-identities:EDIT');
  const { data: senders = [], isLoading, isError } = useSmsSenderIdentities();
  const { data: wallet } = useSmsWalletBalance();
  const createSender = useCreateSmsSenderIdentity();
  const submitSender = useSubmitSmsSenderIdentity();
  const defaultSender = useSetDefaultSmsSenderIdentity();
  const archiveSender = useArchiveSmsSenderIdentity();
  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState<SenderForm>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleCreate() {
    if (!form.senderId.trim()) return;
    createSender.mutate(
      {
        senderId: form.senderId.trim(),
        ...(form.displayName.trim() ? { displayName: form.displayName.trim() } : {}),
      },
      {
        onSuccess: () => {
          toast.success('SMS sender identity created');
          setPanelOpen(false);
          setForm(EMPTY_FORM);
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to create sender ID')),
      },
    );
  }

  function handleSubmitForApproval(id: string) {
    submitSender.mutate(id, {
      onSuccess: () => toast.success('Sender ID submitted for approval'),
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to submit sender ID')),
    });
  }

  function handleSetDefault(id: string) {
    defaultSender.mutate(id, {
      onSuccess: () => toast.success('Default SMS sender ID updated'),
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to set default sender ID')),
    });
  }

  function handleArchive() {
    if (!deleteId) return;
    archiveSender.mutate(deleteId, {
      onSuccess: () => {
        toast.success('SMS sender identity archived');
        setDeleteId(null);
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to archive sender ID')),
    });
  }

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-gray-400">Loading SMS senders...</p>;
  }

  if (isError) {
    return <p className="py-8 text-center text-sm text-red-500">Failed to load SMS senders.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              SMS Wallet
            </p>
            <h2 className="mt-1 text-xl font-bold text-gray-950">
              {(wallet?.availableCredits ?? 0).toLocaleString()} available credits
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {(wallet?.reservedCredits ?? 0).toLocaleString()} reserved ·{' '}
              {(wallet?.totalCredits ?? 0).toLocaleString()} total
            </p>
          </div>
          {canCreate && <Button onClick={() => setPanelOpen(true)}>Add Sender ID</Button>}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-gray-950">SMS Sender Identities</h2>
          <p className="text-sm text-gray-500">
            Campaigns can only use sender IDs that have been approved.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {senders.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">
              No SMS sender identities yet.
            </p>
          ) : (
            senders.map((sender) => (
              <div
                key={sender.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="font-semibold text-gray-950">
                    {sender.senderId}
                    {sender.isDefault ? (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        Default
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-gray-500">
                    {sender.displayName || 'No display name'} · {sender.status.replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canSubmit && ['DRAFT', 'REJECTED'].includes(sender.status) && (
                    <Button
                      variant="outline"
                      onClick={() => handleSubmitForApproval(sender.id)}
                      isLoading={submitSender.isPending}
                    >
                      Submit
                    </Button>
                  )}
                  {canEdit && sender.status === 'APPROVED' && !sender.isDefault && (
                    <Button
                      variant="outline"
                      onClick={() => handleSetDefault(sender.id)}
                      isLoading={defaultSender.isPending}
                    >
                      Set Default
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="danger" onClick={() => setDeleteId(sender.id)}>
                      Archive
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <SidePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        title="Add SMS Sender ID"
        description="Create a draft sender ID before submitting it for provider approval."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} isLoading={createSender.isPending}>
              Create Draft
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Sender ID"
            value={form.senderId}
            onChange={(event) => setForm((prev) => ({ ...prev, senderId: event.target.value }))}
            placeholder="eg; WORKPHELO"
          />
          <Input
            label="Display Name"
            value={form.displayName}
            onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
            placeholder="eg; Main campaigns"
          />
        </div>
      </SidePanel>

      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Archive Sender ID"
        description="Archived sender IDs cannot be used by new SMS campaigns."
        width="max-w-sm"
        height="max-h-fit"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleArchive} isLoading={archiveSender.isPending}>
              Archive
            </Button>
          </>
        }
      />
    </div>
  );
}
