'use client';

import { useState } from 'react';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DetailField } from '@/components/atoms/DetailField';
import { ToggleRow } from '@/components/molecules/shared/ToggleRow';
import type { ProspectDetail } from '@/types/marketing';

interface ConvertToClientModalProps {
  prospect: ProspectDetail;
  isOpen: boolean;
  onClose: () => void;
  /** Called on confirm — the hook for the conversion API call once one exists. */
  onConfirm?: (options: { billable: boolean }) => void;
}

export function ConvertToClientModal({
  prospect,
  isOpen,
  onClose,
  onConfirm,
}: ConvertToClientModalProps) {
  const [billable, setBillable] = useState(false);
  const [converted, setConverted] = useState(false);
  const contact = prospect.contacts.find((c) => c.isPrimary) ?? prospect.contacts[0];

  function handleClose() {
    setBillable(false);
    setConverted(false);
    onClose();
  }

  function handleConfirm() {
    // Front-end only for now: nothing is persisted until a conversion endpoint exists.
    onConfirm?.({ billable });
    setConverted(true);
  }

  if (converted) {
    return (
      <SuccessModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Converted to Client"
        message={`${prospect.companyName} is now a client${billable ? ' and marked as billable' : ''}.`}
      />
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Convert to Client"
      description="Review the client details before converting this prospect."
      width="max-w-xl"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Convert to Client</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <DetailField label="Company Name" value={prospect.companyName} />
          <DetailField label="Type of Business" value={prospect.businessType?.name} />
          <DetailField label="Location" value={prospect.location.label} />
          <DetailField label="Source Type" value={prospect.sourceType?.name} />
          <DetailField label="Contact Person" value={contact?.name} />
          <DetailField label="Role / Job Title" value={contact?.decisionMaker?.name} />
          <DetailField label="Phone" value={contact?.phone} />
          <DetailField label="Email" value={contact?.email} />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <ToggleRow
            label="Make billable"
            description="Mark this client as billable once converted."
            enabled={billable}
            onChange={setBillable}
          />
        </div>
      </div>
    </Modal>
  );
}
