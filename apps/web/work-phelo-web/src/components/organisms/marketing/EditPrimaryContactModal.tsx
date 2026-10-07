'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Modal } from '@/components/organisms/shared/Modal';
import { useProspectingSettings } from '@/hooks/marketing/useProspectingSettings';

export interface PrimaryContactValues {
  name: string;
  phone: string | null;
  email: string | null;
  roleId: string;
}

/** The fields that changed; `null` clears a phone number or email. */
export interface PrimaryContactChanges {
  name?: string;
  phone?: string | null;
  email?: string | null;
  decisionMakerTypeId?: string | null;
}

interface Props {
  /** The prospect or client the contact belongs to, shown under the title. */
  companyName: string;
  current: PrimaryContactValues;
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (changes: PrimaryContactChanges) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** PhoneInput reports just the dial code (+233) while no number is typed. */
const isBlankPhone = (value: string | null | undefined) => !value || /^\+\d{1,3}$/.test(value);

/** Edits the primary contact of a prospect or client: the person campaigns and calls reach. */
export function EditPrimaryContactModal({
  companyName,
  current,
  isOpen,
  isSaving,
  onClose,
  onSave,
}: Props) {
  const { data: roles = [], isLoading } = useProspectingSettings('decision-makers');
  const [name, setName] = useState(current.name);
  const [phone, setPhone] = useState(current.phone ?? '');
  const [email, setEmail] = useState(current.email ?? '');
  const [roleId, setRoleId] = useState(current.roleId);

  const options = useMemo(() => roles.map((r) => ({ value: r.id, label: r.name })), [roles]);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const nextPhone = isBlankPhone(phone) ? null : phone;
  const nextEmail = trimmedEmail || null;

  const nameChanged = trimmedName !== current.name;
  const phoneChanged = nextPhone !== (current.phone || null);
  const emailChanged = nextEmail !== (current.email || null);
  const roleChanged = roleId !== current.roleId;
  const changed = nameChanged || phoneChanged || emailChanged || roleChanged;

  const emailError =
    trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail) ? 'Enter a valid email address' : undefined;

  function handleSave() {
    onSave({
      ...(nameChanged ? { name: trimmedName } : {}),
      ...(phoneChanged ? { phone: nextPhone } : {}),
      ...(emailChanged ? { email: nextEmail } : {}),
      ...(roleChanged ? { decisionMakerTypeId: roleId || null } : {}),
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Primary Contact"
      description={companyName}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!trimmedName || !!emailError || !changed}
            isLoading={isSaving}
            loadingText="Saving…"
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          value={name}
          maxLength={160}
          onChange={(e) => setName(e.target.value)}
          error={!trimmedName ? 'Required' : undefined}
        />
        <SearchSelect
          label="Role"
          placeholder={isLoading ? 'Loading roles...' : 'Select role'}
          options={options}
          value={roleId}
          onChange={setRoleId}
          disabled={isLoading}
        />
        <PhoneInput label="Phone" value={phone} onChange={setPhone} />
        <Input
          label="Email"
          type="email"
          value={email}
          maxLength={254}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="eg; ama.mensah@example.com"
          error={emailError}
        />
      </div>
    </Modal>
  );
}
