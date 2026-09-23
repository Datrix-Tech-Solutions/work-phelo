'use client';

import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { DetailField } from '@/components/atoms/DetailField';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { Modal } from '@/components/organisms/shared/Modal';
import { useDeactivateGLAccount } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { EditLeafAccountPanel } from '@/components/organisms/accounting/panels/EditLeafAccountPanel';
import { AddLeafAccountPanel } from '@/components/organisms/accounting/panels/AddLeafAccountPanel';
import { GLAccountLedger } from '@/components/organisms/accounting/GLAccountLedger';
import type { GLAccount } from '@/types/accounting';

interface GLAccountDetailProps {
  account: GLAccount;
}

const TABS = [
  { key: 'ledger', label: 'Ledger Activity' },
  { key: 'details', label: 'Details' },
];

export function GLAccountDetail({ account }: GLAccountDetailProps) {
  const toast = useToast();
  const { mutateAsync: deactivateAccount, isPending: isDeactivating } = useDeactivateGLAccount();
  const [activeTab, setActiveTab] = useState('ledger');
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingSibling, setIsCreatingSibling] = useState(false);
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);

  // "Create Account" here mirrors this account's own place in the hierarchy — same
  // classification and parent account, if it has one. A leaf account always needs a
  // classification, so this account has to have one too before it can be mirrored; a legacy
  // account with neither just doesn't get the shortcut (the general "Add Account" still works).
  const siblingScope = account.classification?.id
    ? {
        accountType: account.category,
        classificationId: account.classification.id,
        classificationName: account.classification.name,
        groupId: account.accountGroup?.id,
        groupName: account.accountGroup?.name,
      }
    : undefined;

  const deactivate = async () => {
    try {
      await deactivateAccount(account.id);
      toast.success('Account deactivated');
      setConfirmDeactivateOpen(false);
    } catch (error) {
      toast.error(extractError(error, 'Unable to deactivate account'));
    }
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-end justify-between gap-4 border-b border-gray-200">
        <TabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          className="border-b-0"
        />
        <div className="flex items-center gap-3 pb-2 shrink-0">
          <Badge
            label={account.status}
            variant={account.status === 'ACTIVE' ? 'success' : 'neutral'}
          />
          {siblingScope && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreatingSibling(true)}
            >
              Create Account
            </Button>
          )}
          {account.status === 'ACTIVE' && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setConfirmDeactivateOpen(true)}
            >
              Deactivate
            </Button>
          )}
        </div>
      </div>

      {activeTab === 'details' ? (
        <div className="flex flex-1 flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <DetailField label="Category" value={account.category} />
            <DetailField label="Normal Balance" value={account.normalBalance} />
            <DetailField
              label="Classification"
              value={
                account.classification?.id
                  ? `${account.classification.code} — ${account.classification.name}`
                  : 'Unclassified'
              }
            />
            <DetailField
              label="Account Group"
              value={
                account.accountGroup
                  ? `${account.accountGroup.code} — ${account.accountGroup.name}`
                  : '—'
              }
            />
            <DetailField label="Parent Account" value={account.parentAccount?.name ?? '—'} />
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 pt-5">
            <h4 className="text-sm font-semibold text-gray-900">Account settings</h4>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              Edit {account.name}
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <DetailField label="Account Name" value={account.name} />
            <DetailField label="Description" value={account.description || '—'} />
            <DetailField
              label="Allow postings to this account"
              value={account.allowPosting ? 'Yes' : 'No'}
            />
          </div>
        </div>
      ) : (
        <GLAccountLedger accountId={account.id} />
      )}

      <EditLeafAccountPanel
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        account={account}
      />

      <AddLeafAccountPanel
        isOpen={isCreatingSibling}
        onClose={() => setIsCreatingSibling(false)}
        lockedScope={siblingScope}
      />

      <Modal
        isOpen={confirmDeactivateOpen}
        onClose={() => setConfirmDeactivateOpen(false)}
        title="Deactivate account?"
        description={`"${account.name}" will no longer accept new postings. Existing ledger history is preserved. This cannot be undone from here — contact an administrator if you need it reinstated.`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setConfirmDeactivateOpen(false)}
              disabled={isDeactivating}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={deactivate}
              isLoading={isDeactivating}
              loadingText="Deactivating…"
            >
              Deactivate
            </Button>
          </>
        }
      />
    </div>
  );
}
