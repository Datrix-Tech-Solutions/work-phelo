'use client';

import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { DetailField } from '@/components/atoms/DetailField';
import { CAMPAIGN_STATUS_MAP, REUSE_LABEL } from '@/components/molecules/marketing/CampaignsTable';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { formatDate } from '@/lib/formatters';
import type { Campaign } from '@/types/marketing';

interface Props {
  campaign: Campaign | null;
  onClose: () => void;
  /** Omit to hide Resend and Retry (no create permission). */
  onReuse?: (campaign: Campaign) => void;
  /** Omit to hide Edit (no create permission). Shown only while the campaign is scheduled. */
  onEdit?: (campaign: Campaign) => void;
}

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{title}</p>
      {children}
    </section>
  );
}

interface BarSegment {
  key: string;
  label: string;
  color: string;
  value: number;
}

/**
 * One bar split into parts, each sized by its share, with the counts spelled out beneath it. Parts
 * with nothing in them are left out. The legend carries the names and numbers, so colour is never
 * the only cue.
 */
function StackedBar({ segments }: { segments: BarSegment[] }) {
  const shown = segments.filter((segment) => segment.value > 0);
  return (
    <>
      <div
        role="img"
        aria-label={shown.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ')}
        className="flex h-3 w-full gap-0.5"
      >
        {shown.map((segment) => (
          <div
            key={segment.key}
            title={`${segment.label}: ${segment.value}`}
            className="h-full first:rounded-l last:rounded-r"
            style={{ flexGrow: segment.value, flexBasis: 0, background: segment.color }}
          />
        ))}
      </div>

      <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {shown.map((segment) => (
          <li key={segment.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-gray-600">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: segment.color }}
              />
              {segment.label}
            </span>
            <span className="tabular-nums font-medium text-gray-900">{segment.value}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Where every recipient ended up. The status hues are fixed, not themed. */
function DeliveryBreakdown({ recipients }: { recipients: Campaign['recipients'] }) {
  const delivered = recipients.delivered;
  const sent = recipients.sent + recipients.accepted;
  // Skipped and cancelled messages were never going to be delivered, so they don't count against it.
  const reachable = recipients.total - recipients.skipped - recipients.cancelled;

  if (recipients.total === 0) {
    return <p className="text-sm text-gray-500">No recipients.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-gray-900">
          {reachable > 0 ? `${delivered} of ${reachable} delivered` : 'Nothing was reachable'}
        </p>
        {reachable > 0 && (
          <p className="text-xs text-gray-500">
            {Math.round(((delivered + sent) / reachable) * 100)}% sent to the provider
          </p>
        )}
      </div>
      <StackedBar
        segments={[
          { key: 'delivered', label: 'Delivered', color: '#0ca30c', value: delivered },
          { key: 'sent', label: 'Sent, awaiting delivery', color: '#3b82f6', value: sent },
          {
            key: 'inProgress',
            label: 'In progress',
            color: '#fab219',
            value: recipients.pending + recipients.queued + recipients.sending,
          },
          { key: 'failed', label: 'Failed', color: '#d03b3b', value: recipients.failed },
          { key: 'skipped', label: 'Skipped', color: '#9ca3af', value: recipients.skipped },
          { key: 'cancelled', label: 'Cancelled', color: '#d1d5db', value: recipients.cancelled },
        ]}
      />
    </div>
  );
}

/** Once a campaign has finished, credits it reserved but did not use have gone back to the wallet. */
const FINISHED: Campaign['status'][] = ['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED'];

/** How the credits reserved for the campaign were spent. */
function CreditsBreakdown({ campaign }: { campaign: Campaign }) {
  const { reservedCredits: reserved, consumedCredits: used, estimatedCredits } = campaign;

  // Credits are only reserved when the campaign is sent, so until then there is just an estimate.
  if (reserved === 0) {
    return (
      <p className="text-sm text-gray-600">
        <span className="font-semibold text-gray-900">{estimatedCredits ?? 0} credits</span>{' '}
        estimated. They are reserved from the wallet when the campaign is sent.
      </p>
    );
  }

  const unused = Math.max(reserved - used, 0);
  const finished = FINISHED.includes(campaign.status);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-gray-900">
          {used} of {reserved} credits used
        </p>
        {estimatedCredits != null && estimatedCredits !== reserved && (
          <p className="text-xs text-gray-500">{estimatedCredits} estimated</p>
        )}
      </div>
      <StackedBar
        segments={[
          { key: 'used', label: 'Used', color: '#3b82f6', value: used },
          finished
            ? { key: 'returned', label: 'Returned to wallet', color: '#9ca3af', value: unused }
            : { key: 'held', label: 'Still reserved', color: '#bfdbfe', value: unused },
        ]}
      />
    </div>
  );
}

/** Read-only details of a campaign: what it says, who it went to and how delivery went. */
export function CampaignDetailPanel({ campaign, onClose, onReuse, onEdit }: Props) {
  if (!campaign) {
    // Keep the panel mounted so it can slide out; it has nothing to show without a campaign.
    return (
      <SidePanel isOpen={false} onClose={onClose} title="Campaign">
        {null}
      </SidePanel>
    );
  }

  const { recipients } = campaign;
  const status = CAMPAIGN_STATUS_MAP[campaign.status];
  const reuseLabel = REUSE_LABEL[campaign.status];

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={campaign.name}
      description={campaign.subject || undefined}
      descriptionAction={<Badge label={status.label} variant={status.variant} />}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {onEdit && campaign.status === 'SCHEDULED' && (
            <Button onClick={() => onEdit(campaign)}>Edit</Button>
          )}
          {onReuse && reuseLabel && <Button onClick={() => onReuse(campaign)}>{reuseLabel}</Button>}
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <Section title="Campaign">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <DetailField label="Channels" value={campaign.channels.join(', ')} />
            <DetailField
              label="Dispatch"
              value={
                campaign.dispatchMode === 'SCHEDULED' && campaign.scheduledDate
                  ? `Scheduled · ${formatDate(campaign.scheduledDate)}`
                  : 'Instant'
              }
            />
            <DetailField label="Sender ID" value={campaign.senderIdSnapshot} />
            <DetailField label="Created" value={formatDateTime(campaign.createdAt)} />
          </div>
          <DetailField
            label="Target Segments"
            value={campaign.segments.map((segment) => segment.name).join(', ')}
          />
        </Section>

        <Section title="Message">
          <div className="rounded-xl border border-gray-200 p-3 text-sm text-gray-800 whitespace-pre-wrap">
            {campaign.subject && <p className="font-semibold">{campaign.subject}</p>}
            <p>{campaign.message}</p>
          </div>
        </Section>

        <Section title="Delivery">
          <DeliveryBreakdown recipients={recipients} />
        </Section>

        {campaign.channels.includes('SMS') && (
          <Section title="SMS Credits">
            <CreditsBreakdown campaign={campaign} />
          </Section>
        )}

        <Section title="Timeline">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <DetailField
              label="Dispatched"
              value={campaign.dispatchedAt ? formatDateTime(campaign.dispatchedAt) : null}
            />
            <DetailField
              label="Completed"
              value={campaign.completedAt ? formatDateTime(campaign.completedAt) : null}
            />
            {campaign.cancelledAt && (
              <DetailField label="Cancelled" value={formatDateTime(campaign.cancelledAt)} />
            )}
          </div>
        </Section>
      </div>
    </SidePanel>
  );
}
