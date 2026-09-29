'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DetailField } from '@/components/atoms/DetailField';
import type { ProspectDetailInteraction } from '@/types/marketing';

interface InteractionDetailPanelProps {
  interaction: ProspectDetailInteraction | null;
  onClose: () => void;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function InteractionDetailPanel({ interaction, onClose }: InteractionDetailPanelProps) {
  return (
    <SidePanel
      isOpen={!!interaction}
      onClose={onClose}
      title="Interaction Details"
      footer={
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {interaction && (
        <div className="flex flex-col gap-5">
          <DetailField label="Date Contacted" value={formatDate(interaction.occurredAt)} />
          <DetailField label="Interaction Type" value={interaction.interactionMedium?.name} />
          <DetailField label="Decision Maker Met" value={interaction.decisionMaker?.name} />
          <DetailField label="Decision Maker Name" value={interaction.decisionMakerName} />
          <DetailField
            label="Notes"
            value={
              interaction.notes ? (
                <span className="whitespace-pre-wrap">{interaction.notes}</span>
              ) : null
            }
          />
          <DetailField label="Logged On" value={formatDate(interaction.createdAt)} />
        </div>
      )}
    </SidePanel>
  );
}
