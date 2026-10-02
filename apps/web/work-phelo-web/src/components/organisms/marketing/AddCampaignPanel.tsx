'use client';

import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SegmentedToggle } from '@/components/atoms/SegmentedToggle';
import { useProspectingSettings } from '@/hooks/marketing/useProspectingSettings';
import { ProspectingSetting } from '@/types/marketing';

export type CampaignChannel = 'sms' | 'email';

export type CampaignDispatch = 'instant' | 'schedule';

export interface CampaignForm {
  name: string;
  outreachChannel: CampaignChannel[];
  targetSegment: string;
  subject: string;
  message: string;
  dispatch: CampaignDispatch;
  scheduledDate?: string;
}

const DEFAULT_VALUES: CampaignForm = {
  name: '',
  outreachChannel: [],
  targetSegment: '',
  subject: '',
  message: '',
  dispatch: 'instant',
  scheduledDate: '',
};

const DISPATCH_OPTIONS: { label: string; value: CampaignDispatch }[] = [
  { label: 'Instant Send', value: 'instant' },
  { label: 'Schedule', value: 'schedule' },
];

const CHANNEL_OPTIONS: { label: string; value: CampaignChannel }[] = [
  { label: 'SMS', value: 'sms' },
  { label: 'Email', value: 'email' },
];

function toOptions(items: ProspectingSetting[]) {
  return items.map((item) => ({ value: item.id, label: item.name }));
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CampaignForm) => void;
}

export function AddCampaignPanel({ isOpen, onClose, onSubmit }: Props) {
  const { data: businessTypes = [] } = useProspectingSettings('business-types');
  const segmentOptions = useMemo(() => toOptions(businessTypes), [businessTypes]);

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
  const subjectValue = useWatch({ control, name: 'subject' }) ?? '';
  const messageValue = useWatch({ control, name: 'message' }) ?? '';
  const characterCount = subjectValue.length + messageValue.length;
  const dispatchValue = useWatch({ control, name: 'dispatch' });
  const scheduledDateValue = useWatch({ control, name: 'scheduledDate' });

  const handleClose = () => {
    reset(DEFAULT_VALUES);
    onClose();
  };

  const handleFormSubmit = (data: CampaignForm) => {
    onSubmit({
      ...data,
      scheduledDate: data.dispatch === 'schedule' ? data.scheduledDate : undefined,
    });
    reset(DEFAULT_VALUES);
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="New Campaign"
      description="Set up an outreach campaign for a target segment."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(handleFormSubmit)}>
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

        <input type="hidden" {...register('targetSegment', { required: 'Required' })} />
        <SearchSelect
          label="Target Segment"
          placeholder="Select target segment"
          value={segmentValue}
          onChange={(v) => setValue('targetSegment', v, { shouldValidate: true })}
          options={segmentOptions}
          error={errors.targetSegment?.message}
        />

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
    </SidePanel>
  );
}
