'use client';

import { useState } from 'react';
import { Badge, type BadgeProps } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Modal } from '@/components/organisms/shared/Modal';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import {
  useArchiveTenantSmsSenderIdentity,
  useCreateTenantSmsSenderIdentity,
  useSetDefaultTenantSmsSenderIdentity,
  useTenantSmsSenderIdentities,
  useUpdateTenantSmsSenderIdentity,
} from '@/hooks/marketing/useTenantSmsConfig';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { formatDate } from '@/lib/formatters';
import type { SmsSenderIdentity, SmsSenderIdentityStatus } from '@/types/marketing';

const STATUS_VARIANT: Record<SmsSenderIdentityStatus, BadgeProps['variant']> = {
  APPROVED: 'success',
  PENDING_PROVIDER_APPROVAL: 'warning',
  DRAFT: 'neutral',
  REJECTED: 'danger',
  SUSPENDED: 'danger',
  ARCHIVED: 'neutral',
};

interface SenderForm {
  senderId: string;
  displayName: string;
  provider: string;
  providerReference: string;
}

const EMPTY_FORM: SenderForm = {
  senderId: '',
  displayName: '',
  provider: '',
  providerReference: '',
};

function toForm(sender: SmsSenderIdentity): SenderForm {
  return {
    senderId: sender.senderId,
    displayName: sender.displayName ?? '',
    provider: sender.provider ?? '',
    providerReference: sender.providerReference ?? '',
  };
}

export function TenantSmsSenderIds({ tenantId }: { tenantId: string }) {
  const toast = useToast();
  const { data: senders = [], isLoading, isError } = useTenantSmsSenderIdentities(tenantId);
  const createSender = useCreateTenantSmsSenderIdentity(tenantId);
  const updateSender = useUpdateTenantSmsSenderIdentity(tenantId);
  const defaultSender = useSetDefaultTenantSmsSenderIdentity(tenantId);
  const archiveSender = useArchiveTenantSmsSenderIdentity(tenantId);

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SenderForm>(EMPTY_FORM);
  const [archiveTarget, setArchiveTarget] = useState<SmsSenderIdentity | null>(null);

  const isSaving = createSender.isPending || updateSender.isPending;

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPanelOpen(true);
  }

  function openEdit(sender: SmsSenderIdentity) {
    setEditingId(sender.id);
    setForm(toForm(sender));
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleSave() {
    const senderId = form.senderId.trim();
    if (!senderId) return;
    const payload = {
      senderId,
      displayName: form.displayName.trim(),
      provider: form.provider.trim(),
      providerReference: form.providerReference.trim(),
    };
    const done = {
      onSuccess: () => {
        toast.success(editingId ? 'Sender ID updated' : 'Sender ID created');
        closePanel();
      },
      onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Failed to save sender ID')),
    };
    if (editingId) updateSender.mutate({ id: editingId, ...payload }, done);
    else createSender.mutate(payload, done);
  }

  function handleSetDefault(id: string) {
    defaultSender.mutate(id, {
      onSuccess: () => toast.success('Default sender ID updated'),
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to set default sender ID')),
    });
  }

  function handleArchive() {
    if (!archiveTarget) return;
    archiveSender.mutate(archiveTarget.id, {
      onSuccess: () => {
        toast.success('Sender ID archived');
        setArchiveTarget(null);
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to archive sender ID')),
    });
  }

  return (
    <section className="rounded-card border border-gray-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">SMS Sender IDs</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Sender IDs created here are approved immediately and can be used by this company&apos;s
            campaigns.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          Add Sender ID
        </Button>
      </div>

      {isLoading ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">Loading sender IDs…</p>
      ) : isError ? (
        <p className="px-5 py-8 text-center text-sm text-red-500">Failed to load sender IDs.</p>
      ) : senders.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">
          No sender IDs yet. Add one so this company can send SMS campaigns.
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {senders.map((sender) => {
            const editable = sender.status === 'DRAFT' || sender.status === 'REJECTED';
            return (
              <div
                key={sender.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900">{sender.senderId}</p>
                    <Badge
                      label={sender.status.replace(/_/g, ' ').toLowerCase()}
                      variant={STATUS_VARIANT[sender.status]}
                    />
                    {sender.isDefault && <Badge label="default" variant="info" />}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {[sender.displayName, sender.provider, `Added ${formatDate(sender.createdAt)}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {sender.rejectionReason && (
                    <p className="mt-0.5 text-sm text-red-600">{sender.rejectionReason}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {sender.status === 'APPROVED' && !sender.isDefault && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetDefault(sender.id)}
                      isLoading={defaultSender.isPending && defaultSender.variables === sender.id}
                    >
                      Set Default
                    </Button>
                  )}
                  {editable && (
                    <Button size="sm" variant="outline" onClick={() => openEdit(sender)}>
                      Edit
                    </Button>
                  )}
                  <Button size="sm" variant="danger" onClick={() => setArchiveTarget(sender)}>
                    Archive
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SidePanel
        isOpen={panelOpen}
        onClose={closePanel}
        title={editingId ? 'Edit Sender ID' : 'Add Sender ID'}
        description={
          editingId
            ? 'Update the details of this sender ID.'
            : 'The sender ID is approved as soon as it is created.'
        }
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={closePanel}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={isSaving} disabled={!form.senderId.trim()}>
              {editingId ? 'Save Changes' : 'Create Sender ID'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Sender ID"
            value={form.senderId}
            maxLength={32}
            onChange={(e) => setForm((prev) => ({ ...prev, senderId: e.target.value }))}
            placeholder="eg; WORKPHELO"
          />
          <Input
            label="Display Name"
            value={form.displayName}
            maxLength={100}
            onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
            placeholder="eg; Main campaigns"
          />
          <Input
            label="Provider"
            value={form.provider}
            maxLength={80}
            onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value }))}
            placeholder="eg; hubtel"
          />
          <Input
            label="Provider Reference"
            value={form.providerReference}
            maxLength={150}
            onChange={(e) => setForm((prev) => ({ ...prev, providerReference: e.target.value }))}
            placeholder="The provider's ID for this sender"
          />
        </div>
      </SidePanel>

      <Modal
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        title="Archive Sender ID"
        description={`Archive ${archiveTarget?.senderId ?? 'this sender ID'}? It can't be used by new campaigns, and it can't be archived while an active campaign uses it.`}
        width="max-w-sm"
        height="max-h-fit"
        footer={
          <>
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleArchive} isLoading={archiveSender.isPending}>
              Archive
            </Button>
          </>
        }
      />
    </section>
  );
}
