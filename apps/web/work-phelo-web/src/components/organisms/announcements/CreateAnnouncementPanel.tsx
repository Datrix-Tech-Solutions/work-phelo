'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { DatePicker } from '@/components/atoms/DatePicker';

interface AnnouncementForm {
  title: string;
  message: string;
  expiresAt?: string;
  notifyEmail: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateAnnouncementPanel({ isOpen, onClose }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AnnouncementForm>({
    defaultValues: { notifyEmail: false },
  });

  const expiresAtValue = watch('expiresAt');
  const notifyEmail = watch('notifyEmail');

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSendClick = handleSubmit(() => setConfirmOpen(true));

  const onConfirmSend = () => {
    // TODO: wire up mutation
    setConfirmOpen(false);
    handleClose();
  };

  return (
    <>
      <SidePanel
        isOpen={isOpen}
        onClose={handleClose}
        title="New Announcement"
        description="Compose and send an announcement to your organisation."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={onSendClick}>Send Message</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <FormField
            label="Title"
            registration={register('title', { required: 'Required' })}
            error={errors.title}
            placeholder="eg; Q1 All-Hands Meeting"
          />
          <FormField
            label="Message"
            registration={register('message', { required: 'Required' })}
            error={errors.message}
            type="textarea"
            rows={6}
            placeholder="Write your announcement here…"
          />
          <DatePicker
            label="Expiry Date (optional)"
            value={expiresAtValue}
            onChange={(v) => setValue('expiresAt', v)}
            disablePast
          />
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 shrink-0">
              <input type="checkbox" className="sr-only peer" {...register('notifyEmail')} />
              <div className="w-5 h-5 rounded border-2 border-gray-300 bg-white peer-checked:bg-brand peer-checked:border-brand transition-colors group-hover:border-gray-400 flex items-center justify-center">
                {notifyEmail && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 12 12"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Notify via email</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Send this announcement to employees&apos; work email addresses.
              </p>
            </div>
          </label>
        </div>
      </SidePanel>

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Send Announcement?"
        description="This announcement will be sent to all employees in your organisation. Are you sure you want to proceed?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onConfirmSend}>Send</Button>
          </>
        }
      />
    </>
  );
}
