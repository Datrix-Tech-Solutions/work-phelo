'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/atoms/Button';
import { SidePanel } from '@/components/organisms/shared/SidePanel';

interface AddClaimPaymentFormProps {
  onPlacementsChange?: (placementIds: string[]) => void;
  defaultOpen?: boolean;
}

export default function AddClaimPaymentForm({
  onPlacementsChange,
  defaultOpen = false,
}: AddClaimPaymentFormProps) {
  const [panelOpen, setPanelOpen] = useState(defaultOpen);
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  return (
    <>
      <Button
        onClick={() => {
          onPlacementsChange?.([]);
          setPanelOpen(true);
        }}
      >
        Claim Settlements
      </Button>

      <SidePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        title="Record Claim Settlement"
        description="Claim settlements are recorded against a specific claim, then financially confirmed by Accounting."
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setPanelOpen(false)}>
              Close
            </Button>
            <Link href={`/${tenantSlug}/operations/reinsurance/claims`}>
              <Button type="button">Open Claims</Button>
            </Link>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-gray-700">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="font-semibold text-blue-950">Use the claim settlement workflow</p>
            <p className="mt-2 text-blue-900">
              Open the claim, review the backend-calculated Cedant settlement position, and record
              the settlement from the claim details. Accounting will then confirm the bank/cash
              movement from the Financial Confirmation Queue.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="font-semibold text-gray-900">Source-owned facts remain read-only</p>
            <p className="mt-2 text-gray-600">
              Amount, currency, Cedant, claim reference and operational payment details are owned by
              Reinsurance. Accounting only supplies confirmation date, reference, cash account, FX
              and bank charges during financial confirmation.
            </p>
          </div>
        </div>
      </SidePanel>
    </>
  );
}
