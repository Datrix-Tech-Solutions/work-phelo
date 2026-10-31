'use client';

import { useMemo, useState } from 'react';
import { BellPlus, CalendarPlus, Handshake, MessageSquarePlus, UserPlus } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  QuickActionEntry,
  QuickActionTiles,
} from '@/components/molecules/marketing/QuickActionTiles';
import { AddProspectPanel } from '@/components/organisms/marketing/AddProspectPanel';
import { AddClientPanel } from '@/components/organisms/marketing/AddClientPanel';
import { AddInteractionPanel } from '@/components/organisms/marketing/AddInteractionPanel';
import { NewAppointmentModal } from '@/components/organisms/marketing/NewAppointmentModal';
import { AddReminderPanel } from '@/components/organisms/marketing/AddReminderPanel';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { useProspect, useProspects } from '@/hooks/marketing/useProspects';

type Action = 'prospect' | 'client' | 'follow-up' | 'reminder' | 'appointment';

/** The CRM dashboard's shortcuts: add a prospect or client, record a follow-up, schedule a reminder or an appointment. */
export function CrmQuickActions({
  className,
  fillCell = false,
}: {
  className?: string;
  /** On wide screens, fill the grid cell instead of adding to its height. */
  fillCell?: boolean;
}) {
  const [active, setActive] = useState<Action | null>(null);
  // Follow-ups are recorded against one prospect, so that is picked first.
  const [followUpProspectId, setFollowUpProspectId] = useState('');
  const [recordingProspectId, setRecordingProspectId] = useState<string | null>(null);
  const [prospectSearch, setProspectSearch] = useState('');

  const canAddProspect = useAnyPermissionRules(['marketing.prospects:CREATE']);
  const canAddClient = useAnyPermissionRules(['marketing.clients:CREATE']);
  const canRecord = useAnyPermissionRules([
    'marketing.prospects.interactions:CREATE',
    'marketing.prospects.interactions.all:CREATE',
  ]);
  const canRemind = useAnyPermissionRules([
    'marketing.follow-ups:CREATE',
    'marketing.follow-ups.all:CREATE',
  ]);

  const { data: prospectsPage } = useProspects(
    { limit: 100, search: prospectSearch || undefined },
    active === 'follow-up',
  );
  const prospectOptions = useMemo(
    () => (prospectsPage?.data ?? []).map((p) => ({ value: p.id, label: p.companyName })),
    [prospectsPage],
  );
  const { data: recordingProspect } = useProspect(recordingProspectId ?? '');
  const recordingContact =
    recordingProspect?.contacts.find((c) => c.isPrimary) ?? recordingProspect?.contacts[0];

  const entries = useMemo<QuickActionEntry<Action>[]>(
    () => [
      {
        key: 'prospect',
        label: 'Add Prospect',
        icon: UserPlus,
        color: '#2a78d6',
        allowed: canAddProspect,
      },
      {
        key: 'client',
        label: 'Add Client',
        icon: Handshake,
        color: '#1baf7a',
        allowed: canAddClient,
      },
      {
        key: 'follow-up',
        label: 'Add Follow-up',
        icon: MessageSquarePlus,
        color: '#7c3aed',
        allowed: canRecord,
      },
      {
        key: 'appointment',
        label: 'Add Appointment',
        icon: CalendarPlus,
        color: '#0d9488',
        // Anyone can request one for themselves; the server limits whom they may book for.
        allowed: true,
      },
      {
        key: 'reminder',
        label: 'Add Reminder',
        icon: BellPlus,
        color: '#eb6834',
        allowed: canRemind,
      },
    ],
    [canAddProspect, canAddClient, canRecord, canRemind],
  );

  function closePicker() {
    setActive(null);
    setFollowUpProspectId('');
    setProspectSearch('');
  }

  return (
    <>
      <QuickActionTiles
        storageKey="crm-quick-actions-usage"
        entries={entries}
        onSelect={setActive}
        className={className}
        fillCell={fillCell}
      />

      <AddProspectPanel isOpen={active === 'prospect'} onClose={() => setActive(null)} />
      <AddClientPanel isOpen={active === 'client'} onClose={() => setActive(null)} />
      <NewAppointmentModal isOpen={active === 'appointment'} onClose={() => setActive(null)} />
      <AddReminderPanel isOpen={active === 'reminder'} onClose={() => setActive(null)} />

      <Modal
        isOpen={active === 'follow-up'}
        onClose={closePicker}
        title="Add Follow-up"
        description="Choose the prospect this follow-up is for."
        footer={
          <>
            <Button variant="outline" onClick={closePicker}>
              Cancel
            </Button>
            <Button
              disabled={!followUpProspectId}
              onClick={() => {
                setRecordingProspectId(followUpProspectId);
                closePicker();
              }}
            >
              Continue
            </Button>
          </>
        }
      >
        <SearchSelect
          label="Prospect Name"
          placeholder="Select a prospect"
          options={prospectOptions}
          value={followUpProspectId}
          onChange={setFollowUpProspectId}
          onQueryChange={setProspectSearch}
        />
      </Modal>

      <AddInteractionPanel
        prospectId={recordingProspectId ?? ''}
        isOpen={!!recordingProspectId}
        onClose={() => setRecordingProspectId(null)}
        primaryContact={
          recordingContact && {
            name: recordingContact.name,
            phone: recordingContact.phone,
            role: recordingContact.decisionMaker?.name,
          }
        }
      />
    </>
  );
}
