'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import { Input } from '@/components/atoms/Input';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { Modal } from '@/components/organisms/shared/Modal';
import { ConfirmDeleteProspectModal } from '@/components/molecules/marketing/ConfirmDeleteProspectModal';
import { usePipelineStages } from '@/hooks/marketing/usePipelineStages';
import { useProspectingSettings } from '@/hooks/marketing/useProspectingSettings';
import {
  useCampaignRecipientOptions,
  useCreateSegment,
  useDeleteSegment,
  useSegmentCount,
  useUpdateSegment,
} from '@/hooks/marketing/useCampaigns';
import { useRecipientPicker } from '@/hooks/marketing/useRecipientPicker';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import type { CampaignRecipientOption, CampaignSegment } from '@/types/marketing';

interface Props {
  isOpen: boolean;
  /** A saved segment to edit; leave empty to create a new one. */
  segment?: CampaignSegment | null;
  onClose: () => void;
  /** Called with the saved segment so the campaign can select it straight away. */
  onSaved: (segment: CampaignSegment) => void;
  /** Called after a delete, so the campaign can drop it from its selection. */
  onDeleted?: (id: string) => void;
}

export function CampaignSegmentModal({ isOpen, segment, onClose, onSaved, onDeleted }: Props) {
  // Picked prospects are saved as ids, so look their names up before showing an existing segment.
  const pickedIds = useMemo(
    () => [...(segment?.includeProspectIds ?? []), ...(segment?.excludeProspectIds ?? [])],
    [segment],
  );
  const { data: picked, isLoading } = useCampaignRecipientOptions(
    { ids: pickedIds },
    '',
    isOpen && pickedIds.length > 0,
  );

  if (!isOpen) return null;
  const ready = pickedIds.length === 0 || (!isLoading && !!picked);
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={segment ? 'Edit Segment' : 'Create Segment'}
      description="A saved segment is shared with everyone and can be picked for any campaign."
      width="max-w-xl"
      height="max-h-[85vh]"
    >
      {ready ? (
        <SegmentForm
          key={segment?.id ?? 'new'}
          segment={segment ?? null}
          picked={picked ?? []}
          onClose={onClose}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      ) : (
        <p className="text-sm text-gray-500 py-6 text-center">Loading…</p>
      )}
    </Modal>
  );
}

function SegmentForm({
  segment,
  picked,
  onClose,
  onSaved,
  onDeleted,
}: {
  segment: CampaignSegment | null;
  picked: CampaignRecipientOption[];
  onClose: () => void;
  onSaved: (segment: CampaignSegment) => void;
  onDeleted?: (id: string) => void;
}) {
  const toast = useToast();
  const create = useCreateSegment();
  const update = useUpdateSegment();
  const remove = useDeleteSegment();
  const { data: businessTypes = [] } = useProspectingSettings('business-types');
  const { data: stages = [] } = usePipelineStages();

  const [name, setName] = useState(segment?.name ?? '');
  const [businessTypeIds, setBusinessTypeIds] = useState(segment?.businessTypeIds ?? []);
  const [pipelineStageIds, setPipelineStageIds] = useState(segment?.pipelineStageIds ?? []);
  const [nameError, setNameError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const filters = { businessTypeIds, pipelineStageIds };
  const included = useRecipientPicker(
    filters,
    picked.filter((p) => segment?.includeProspectIds.includes(p.id)),
  );
  const excluded = useRecipientPicker(
    filters,
    picked.filter((p) => segment?.excludeProspectIds.includes(p.id)),
  );

  const rules = {
    businessTypeIds,
    pipelineStageIds,
    includeProspectIds: included.selectedIds,
    excludeProspectIds: excluded.selectedIds,
  };
  const hasRules =
    businessTypeIds.length > 0 || pipelineStageIds.length > 0 || included.selectedIds.length > 0;
  const count = useSegmentCount(rules);
  const isSaving = create.isPending || update.isPending;

  function handleSave() {
    if (!name.trim()) {
      setNameError('Required');
      return;
    }
    setNameError('');
    const payload = { name: name.trim(), recipientType: 'PROSPECT' as const, ...rules };
    const done = {
      onSuccess: (saved: CampaignSegment) => {
        toast.success(segment ? 'Segment updated' : 'Segment saved');
        onSaved(saved);
        onClose();
      },
      onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Failed to save segment')),
    };
    if (segment) update.mutate({ id: segment.id, ...payload }, done);
    else create.mutate(payload, done);
  }

  function handleDelete() {
    if (!segment) return;
    remove.mutate(segment.id, {
      onSuccess: () => {
        toast.success('Segment deleted');
        onDeleted?.(segment.id);
        onClose();
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to delete segment')),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Segment Name"
        placeholder="eg; Insurance prospects in negotiation"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={nameError}
        maxLength={100}
      />

      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        <label className="text-sm font-bold text-gray-900">Recipients</label>
        <div className="px-4 py-3 border border-gray-200 rounded-input bg-gray-50 text-sm text-gray-600 select-none">
          Prospects
        </div>
        <p className="text-xs text-gray-400">Clients will be available soon.</p>
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-1">Filters</p>
      <MultiSelect
        label="Business Type"
        placeholder="Any business type"
        options={businessTypes.map((item) => ({ value: item.id, label: item.name }))}
        value={businessTypeIds}
        onChange={setBusinessTypeIds}
      />
      <MultiSelect
        label="Sales Stage"
        placeholder="Any sales stage"
        options={stages.map((stage) => ({
          value: stage.id,
          label: stage.name,
          sublabel: `${stage.probability}%`,
        }))}
        value={pipelineStageIds}
        onChange={setPipelineStageIds}
      />

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-1">
        Specific Prospects
      </p>
      <ProspectPicker
        label="Always include (optional)"
        picker={included}
        hint="Added even when they don't match the filters."
      />
      <ProspectPicker
        label="Never include (optional)"
        picker={excluded}
        hint="Left out even when they match the filters."
      />

      <div className="rounded-input bg-blue-50 px-4 py-2 text-sm text-gray-700">
        {!hasRules
          ? 'Add a filter or pick a prospect to see who is in this segment.'
          : count.isLoading
            ? 'Counting…'
            : `${count.data ?? 0} prospect${count.data === 1 ? '' : 's'} in this segment`}
      </div>

      <div className="flex items-center justify-between gap-2 mt-1">
        <div>
          {segment && (
            <Button
              variant="outline"
              onClick={() => setConfirmingDelete(true)}
              disabled={isSaving}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Delete
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} isLoading={isSaving} loadingText="Saving…">
            {segment ? 'Save Changes' : 'Save Segment'}
          </Button>
        </div>
      </div>

      {confirmingDelete && segment && (
        <ConfirmDeleteProspectModal
          title="Delete Segment"
          name={segment.name}
          consequence="removes it for everyone. Campaigns already created from it are not affected"
          isDeleting={remove.isPending}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}

function ProspectPicker({
  label,
  hint,
  picker,
}: {
  label: string;
  hint: string;
  picker: ReturnType<typeof useRecipientPicker>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <MultiSelect
        label={label}
        placeholder={picker.isLoading ? 'Loading…' : 'Search prospects'}
        options={picker.options}
        value={picker.selectedIds}
        onChange={picker.onChange}
        onQueryChange={picker.setSearch}
        hideChips
      />
      <p className="text-xs text-gray-400 -mt-1">{hint}</p>
      {picker.selected.map((prospect) => (
        <div
          key={prospect.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{prospect.companyName}</p>
            <p className="text-xs text-gray-500 truncate">
              {[prospect.contactName, prospect.locationLabel].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => picker.remove(prospect.id)}
            className="text-gray-400 hover:text-red-400 transition-colors shrink-0"
          >
            <Icons.X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
