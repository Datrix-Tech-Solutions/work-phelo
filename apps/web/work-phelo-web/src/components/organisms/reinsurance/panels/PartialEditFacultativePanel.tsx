'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormSection } from '@/components/atoms/FormSection';
import { DetailField } from '@/components/atoms/DetailField';
import { Facultative } from '@/types/reinsurance';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';

interface PartialEditFacultativePanelProps {
  isOpen: boolean;
  placement: Facultative;
  onClose: () => void;
}

function fmtFieldValue(val: unknown): string {
  if (val == null) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null, currency: string | null) {
  if (val == null) return '—';
  return `${currency ?? ''} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

// Placement is closed/mostly-closed at this point, so only the policy number is editable here.
// Everything else is shown read-only. Not wired to a save mutation yet — Save Changes just closes.
export function PartialEditFacultativePanel({
  isOpen,
  placement,
  onClose,
}: PartialEditFacultativePanelProps) {
  const [reference, setReference] = useState(placement.reference);

  const riskEntries = [
    ...placementDetailEntries(placement.businessDetails),
    ...placementDetailEntries(placement.offerDetails),
  ];

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Partial Edit Facultative Placement"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>Save Changes</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-7">
        <FormSection title="Policy Details">
          <div className="grid grid-cols-2 gap-3">
            <DetailField label="Insurance Company" value={placement.cedant.name} />
            <DetailField label="Risk Type" value={placement.classOfBusiness ?? '—'} />
          </div>
        </FormSection>

        {riskEntries.length > 0 && (
          <FormSection title="Risk Details">
            <div className="grid grid-cols-2 gap-3">
              {riskEntries.map((entry) => (
                <DetailField
                  key={entry.key}
                  label={entry.label}
                  value={fmtFieldValue(entry.value)}
                />
              ))}
            </div>
          </FormSection>
        )}

        <FormSection title="Offer Details">
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Policy Number"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. POL-2024-001"
              />
              <DetailField label="Insured" value={placement.title} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <DetailField
                label="100% Sum Insured"
                value={fmtAmount(placement.sumInsured, placement.currency)}
              />
              <DetailField
                label="Rate (%)"
                value={placement.rate != null ? `${placement.rate}%` : '—'}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <DetailField
                label="100% Premium"
                value={fmtAmount(placement.premium, placement.currency)}
              />
              <DetailField
                label="Facultative Offer (%)"
                value={placement.facultativeOffer != null ? `${placement.facultativeOffer}%` : '—'}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <DetailField
                label="Cedant Commission (%)"
                value={placement.commission != null ? `${placement.commission}%` : '—'}
              />
              <DetailField label="Currency" value={placement.currency ?? '—'} />
            </div>
          </div>
        </FormSection>

        <FormSection title="Period of Insurance">
          <div className="grid grid-cols-2 gap-3">
            <DetailField label="Inception" value={fmtDate(placement.inceptionDate)} />
            <DetailField label="Expiry" value={fmtDate(placement.expiryDate)} />
          </div>
        </FormSection>

        <FormSection title="Comment">
          <DetailField label="" value={placement.description || '—'} />
        </FormSection>
      </div>
    </SidePanel>
  );
}
