'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SegmentedToggle } from '@/components/atoms/SegmentedToggle';
import { Icons } from '@/components/atoms/icons';
import { CampaignSegmentModal } from '@/components/organisms/marketing/CampaignSegmentModal';
import {
  useCampaignEstimate,
  useCampaignPreview,
  useCampaignSegments,
} from '@/hooks/marketing/useCampaigns';
import { useSmsSenderIdentities } from '@/hooks/marketing/useSmsMarketing';
import type { CampaignChannel, CampaignSegment } from '@/types/marketing';

export type CampaignDispatch = 'instant' | 'schedule';

export interface CampaignForm {
  name: string;
  outreachChannel: CampaignChannel[];
  /** Segment ids: saved segments, or `business-type:<id>` for a built-in one. */
  targetSegment: string[];
  subject: string;
  message: string;
  senderIdentityId?: string;
  dispatch: CampaignDispatch;
  scheduledDate?: string;
}

const DEFAULT_VALUES: CampaignForm = {
  name: '',
  outreachChannel: [],
  targetSegment: [],
  subject: '',
  message: '',
  senderIdentityId: '',
  dispatch: 'instant',
  scheduledDate: '',
};

const DISPATCH_OPTIONS: { label: string; value: CampaignDispatch }[] = [
  { label: 'Instant Send', value: 'instant' },
  { label: 'Schedule', value: 'schedule' },
];

const CHANNEL_OPTIONS: { label: string; value: CampaignChannel }[] = [
  { label: 'SMS', value: 'SMS' },
  { label: 'Email', value: 'EMAIL' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CampaignForm) => void;
  isSubmitting?: boolean;
}

export function AddCampaignPanel({ isOpen, onClose, onSubmit, isSubmitting }: Props) {
  const { data: segments = [] } = useCampaignSegments(isOpen);
  const [segmentModal, setSegmentModal] = useState<{ segment: CampaignSegment | null } | null>(
    null,
  );
  const { data: approvedSenders = [] } = useSmsSenderIdentities({ status: 'APPROVED' });
  const segmentOptions = useMemo(
    () =>
      segments.map((segment) => ({
        value: segment.id,
        label: segment.name,
        sublabel: `${segment.builtIn ? 'Business type' : 'Saved segment'} · ${segment.prospectCount} prospect${segment.prospectCount === 1 ? '' : 's'}`,
      })),
    [segments],
  );
  const senderOptions = useMemo(
    () =>
      approvedSenders.map((sender) => ({
        value: sender.id,
        label: sender.displayName ? `${sender.senderId} · ${sender.displayName}` : sender.senderId,
        isDefault: sender.isDefault,
      })),
    [approvedSenders],
  );

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<CampaignForm>({ defaultValues: DEFAULT_VALUES });

  const channelValue = useWatch({ control, name: 'outreachChannel' });
  const segmentValue = useWatch({ control, name: 'targetSegment' });

  const selectedSegments = useMemo(
    () =>
      (segmentValue ?? []).flatMap((id) => {
        const segment = segments.find((item) => item.id === id);
        return segment ? [segment] : [];
      }),
    [segmentValue, segments],
  );
  const subjectValue = useWatch({ control, name: 'subject' }) ?? '';
  const messageValue = useWatch({ control, name: 'message' }) ?? '';
  const senderIdentityId = useWatch({ control, name: 'senderIdentityId' });
  const characterCount = subjectValue.length + messageValue.length;
  const dispatchValue = useWatch({ control, name: 'dispatch' });
  const scheduledDateValue = useWatch({ control, name: 'scheduledDate' });
  const usesSms = channelValue?.includes('SMS') ?? false;

  // The caller closes the panel after a successful save, so reset on close rather than on submit:
  // a failed save keeps what the user typed.
  useEffect(() => {
    if (!isOpen) reset(DEFAULT_VALUES);
  }, [isOpen, reset]);

  const preview = useCampaignPreview({
    segmentIds: segmentValue,
    channels: channelValue,
  });
  const estimate = useCampaignEstimate({
    segmentIds: segmentValue,
    channels: channelValue,
    subject: subjectValue,
    message: messageValue,
    senderIdentityId,
  });

  useEffect(() => {
    if (!usesSms || senderIdentityId || senderOptions.length === 0) return;
    const defaultSender = senderOptions.find((sender) => sender.isDefault) ?? senderOptions[0];
    setValue('senderIdentityId', defaultSender.value, { shouldValidate: true });
  }, [senderIdentityId, senderOptions, setValue, usesSms]);

  const handleClose = () => onClose();

  const handleFormSubmit = (data: CampaignForm) => {
    onSubmit({
      ...data,
      scheduledDate: data.dispatch === 'schedule' ? data.scheduledDate : undefined,
    });
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="New Campaign"
      description="Set up an outreach campaign for a target segment."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(handleFormSubmit)} isLoading={isSubmitting}>
            {dispatchValue === 'schedule' ? 'Schedule Campaign' : 'Send Campaign'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Campaign Details
        </p>

        <FormField
          label="Campaign Name"
          registration={register('name', { required: 'Required' })}
          error={errors.name}
          placeholder="eg; Q4 Product Launch"
        />

        <input
          type="hidden"
          {...register('outreachChannel', {
            validate: (v) => v.length > 0 || 'Select at least one channel',
          })}
        />
        <MultiSelect
          label="Outreach Channel"
          placeholder="Select outreach channels"
          value={channelValue}
          onChange={(v) =>
            setValue('outreachChannel', v as CampaignChannel[], { shouldValidate: true })
          }
          options={CHANNEL_OPTIONS}
          error={errors.outreachChannel?.message}
        />

        <input
          type="hidden"
          {...register('targetSegment', {
            validate: (v) => v.length > 0 || 'Select at least one target segment',
          })}
        />
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <MultiSelect
              label="Target Segment"
              placeholder="Select target segments"
              value={segmentValue}
              onChange={(v) => setValue('targetSegment', v, { shouldValidate: true })}
              options={segmentOptions}
              error={errors.targetSegment?.message}
              hideChips
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setSegmentModal({ segment: null })}
            className="shrink-0 h-11.5"
          >
            + Create
          </Button>
        </div>

        {selectedSegments.length > 0 && (
          <div className="flex flex-col gap-2">
            {selectedSegments.map((segment) => (
              <div
                key={segment.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{segment.name}</p>
                  <p className="text-xs text-gray-500">
                    {segment.builtIn ? 'Business type' : 'Saved segment'} · {segment.prospectCount}{' '}
                    prospect{segment.prospectCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {!segment.builtIn && (
                    <button
                      type="button"
                      onClick={() => setSegmentModal({ segment })}
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setValue(
                        'targetSegment',
                        (segmentValue ?? []).filter((id) => id !== segment.id),
                        { shouldValidate: true },
                      )
                    }
                    className="text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Icons.X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {preview.data && (
          <p className="text-xs text-gray-500">
            {preview.data.prospectCount} unique prospect
            {preview.data.prospectCount === 1 ? '' : 's'} across the selected segment
            {selectedSegments.length === 1 ? '' : 's'} · {preview.data.reachable} message
            {preview.data.reachable === 1 ? '' : 's'}
          </p>
        )}

        {usesSms && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="text-sm font-bold text-gray-900">Approved SMS Sender ID</label>
            <select
              {...register('senderIdentityId', {
                validate: (v) => !usesSms || !!v || 'Select an approved SMS sender ID',
              })}
              className="mt-2 w-full rounded-input border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
            >
              <option value="">Select sender ID</option>
              {senderOptions.map((sender) => (
                <option key={sender.value} value={sender.value}>
                  {sender.label}
                  {sender.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
            {errors.senderIdentityId && (
              <p className="mt-1 text-xs text-red-500">{errors.senderIdentityId.message}</p>
            )}
            {senderOptions.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">
                No approved SMS sender ID is available. Create and approve one in Marketing settings
                before creating an SMS campaign.
              </p>
            )}
          </div>
        )}

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-2">
          Message
        </p>

        <FormField
          label="Subject Line"
          registration={register('subject', { required: 'Required' })}
          error={errors.subject}
          placeholder="eg; Introducing our new product"
        />

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Message Body</label>
          <textarea
            {...register('message', { required: 'Required' })}
            rows={6}
            placeholder="Write your message…"
            className="w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand resize-none"
          />
          {errors.message && <p className="text-xs text-red-500">{errors.message.message}</p>}
        </div>

        <div className="flex items-center justify-between rounded-input bg-blue-50 px-4 py-2 text-sm">
          <span className="font-bold text-gray-900">Total Characters</span>
          <span className="text-gray-600">
            {characterCount.toLocaleString()}
            <span className="text-xs text-gray-400">
              {' '}
              (subject {subjectValue.length} + body {messageValue.length})
            </span>
          </span>
        </div>

        {usesSms && estimate.data && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <span className="font-bold">SMS encoding:</span> {estimate.data.smsEncoding}
              </p>
              <p>
                <span className="font-bold">Segments/message:</span>{' '}
                {estimate.data.segmentsPerMessage}
              </p>
              <p>
                <span className="font-bold">SMS recipients:</span> {estimate.data.smsRecipientCount}
              </p>
              <p>
                <span className="font-bold">Estimated credits:</span>{' '}
                {estimate.data.estimatedCredits.toLocaleString()}
              </p>
              <p>
                <span className="font-bold">Available credits:</span>{' '}
                {estimate.data.wallet.availableCredits.toLocaleString()}
              </p>
              <p>
                <span className="font-bold">Reserved credits:</span>{' '}
                {estimate.data.wallet.reservedCredits.toLocaleString()}
              </p>
            </div>
            {!estimate.data.wallet.sufficientCredits && (
              <p className="mt-3 rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800">
                Insufficient SMS credits. Shortfall:{' '}
                {estimate.data.wallet.shortfallCredits.toLocaleString()}
              </p>
            )}
            {estimate.data.warnings.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-blue-800">
                {estimate.data.warnings.map((warning) => (
                  <li key={`${warning.code}-${warning.count ?? 0}`}>
                    {warning.message}
                    {warning.count ? ` (${warning.count})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-2">
          Dispatch Timeline
        </p>

        <SegmentedToggle
          value={dispatchValue}
          onChange={(v) => setValue('dispatch', v)}
          options={DISPATCH_OPTIONS}
        />

        {dispatchValue === 'schedule' && (
          <>
            <input
              type="hidden"
              {...register('scheduledDate', {
                validate: (v) => dispatchValue !== 'schedule' || !!v || 'Required',
              })}
            />
            <DatePicker
              label="Schedule Date"
              value={scheduledDateValue}
              onChange={(v) => setValue('scheduledDate', v, { shouldValidate: true })}
              error={errors.scheduledDate?.message}
              disablePast
            />
          </>
        )}
      </div>
      <CampaignSegmentModal
        isOpen={!!segmentModal}
        segment={segmentModal?.segment}
        onClose={() => setSegmentModal(null)}
        onSaved={(saved) => {
          const current = segmentValue ?? [];
          if (!current.includes(saved.id)) {
            setValue('targetSegment', [...current, saved.id], { shouldValidate: true });
          }
        }}
        onDeleted={(id) =>
          setValue(
            'targetSegment',
            (segmentValue ?? []).filter((item) => item !== id),
            { shouldValidate: true },
          )
        }
      />
    </SidePanel>
  );
}
