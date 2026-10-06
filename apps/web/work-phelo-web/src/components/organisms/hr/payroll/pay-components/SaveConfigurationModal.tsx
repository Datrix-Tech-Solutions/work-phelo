'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import {
  PAYSLIP_TYPES,
  PAYSLIP_TYPE_ORDER,
  checkConfiguration,
  type PayComponent,
  type PayslipTypeKey,
  diffComponents,
  latestVersion,
  localIsoDate,
  sameComponents,
  type SavedConfiguration,
} from '@/lib/payroll-engine';

interface SaveConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  components: PayComponent[];
  configurations: SavedConfiguration[];
  /** The configuration being edited, if it was opened or saved before. */
  current: SavedConfiguration | null;
  /** The payslip type the sample was previewing, ticked by default for a new configuration. */
  previewType: PayslipTypeKey;
  isSaving: boolean;
  /** Why the last save failed, from the server. */
  error: string | null;
  onSave: (input: {
    name: string;
    payslipType: PayslipTypeKey;
    effectiveFrom: string;
    note: string;
  }) => void;
}

export function SaveConfigurationModal({
  isOpen,
  onClose,
  components,
  configurations,
  current,
  previewType,
  isSaving,
  error,
  onSave,
}: SaveConfigurationModalProps) {
  const [name, setName] = useState(current?.name ?? '');
  const latest = current ? latestVersion(current) : null;
  const hasChanges = !latest || !sameComponents(latest.components, components);
  // A new version can't start before the one it replaces.
  const minDate = latest?.effectiveFrom;
  const today = localIsoDate();
  const [effectiveFrom, setEffectiveFrom] = useState(minDate && minDate > today ? minDate : today);
  const [note, setNote] = useState('');
  const changes = latest ? diffComponents(latest.components, components) : [];
  const [type, setType] = useState<PayslipTypeKey>(current?.payslipType ?? previewType);

  const check = useMemo(() => checkConfiguration(components, type), [type, components]);
  const canSave =
    name.trim() !== '' && check.errors.length === 0 && (!hasChanges || effectiveFrom !== '');
  const takenFrom = configurations.find((c) => c.id !== current?.id && c.payslipType === type);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Save configuration"
      description="Choose the payslip type this configuration is used for and when changes take effect."
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!canSave}
            isLoading={isSaving}
            loadingText="Saving…"
            onClick={() =>
              onSave({ name: name.trim(), payslipType: type, effectiveFrom, note: note.trim() })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="mt-4 flex flex-col gap-4">
        <Input
          label="Configuration name"
          placeholder="e.g. Ghana monthly payroll"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <SearchSelect
          label="Used for"
          clearable={false}
          options={PAYSLIP_TYPE_ORDER.map((key) => ({
            value: key,
            label: PAYSLIP_TYPES[key].label,
            sublabel: PAYSLIP_TYPES[key].description,
          }))}
          value={type}
          onChange={(v) => v && setType(v as PayslipTypeKey)}
        />

        {hasChanges ? (
          <>
            <DatePicker
              label="Takes effect from"
              value={effectiveFrom}
              minDate={minDate}
              onChange={setEffectiveFrom}
            />
            <span className="-mt-2 text-xs text-gray-500">
              Payroll runs dated before this keep using the earlier version.
            </span>
            <Input
              label="What changed and why"
              placeholder="e.g. New PAYE bands from the 2027 budget"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {changes.length > 0 && (
              <p className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600">
                {changes.join('. ')}.
              </p>
            )}
          </>
        ) : (
          <p className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600">
            No component changes, so this won&apos;t create a new version.
          </p>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        {takenFrom && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {PAYSLIP_TYPES[type].label} payslips currently use &ldquo;{takenFrom.name}&rdquo;.
            Saving replaces it.
          </p>
        )}
        {check.errors.map((message) => (
          <p key={message} className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {message}
          </p>
        ))}
        {check.warnings.map((message) => (
          <p key={message} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {message}
          </p>
        ))}
      </div>
    </Modal>
  );
}
