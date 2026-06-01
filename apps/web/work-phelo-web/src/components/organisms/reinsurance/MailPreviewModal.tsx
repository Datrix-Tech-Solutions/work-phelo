'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FileUpload } from '@/components/atoms/FileUpload';
import { CreatableSearchSelect } from '@/components/atoms/CreatableSearchSelect';
import { Icons } from '@/components/atoms/icons';
import { inputClass } from '@/lib/utils';
import { Facultative } from '@/types/reinsurance';

interface MailPreviewModalProps {
  isOpen: boolean;
  placement: Facultative;
  brokerageFee: number;
  recipients: string[];
  onSend: () => void;
  onClose: () => void;
}

export function MailPreviewModal({
  isOpen,
  placement,
  recipients,
  onSend,
  onClose,
}: MailPreviewModalProps) {
  const [localRecipients, setLocalRecipients] = useState<string[]>(recipients);
  const [addingRecipient, setAddingRecipient] = useState(false);
  const [recipientDraft, setRecipientDraft] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);

  const removeRecipient = (email: string) =>
    setLocalRecipients((prev) => prev.filter((e) => e !== email));

  const commitRecipient = (email: string) => {
    const trimmed = email.trim();
    if (trimmed && !localRecipients.includes(trimmed)) {
      setLocalRecipients((prev) => [...prev, trimmed]);
    }
    setRecipientDraft('');
    setAddingRecipient(false);
  };

  const handleClose = () => {
    setLocalRecipients([]);
    setAddingRecipient(false);
    setRecipientDraft('');
    setSubject('');
    setBody('');
    setAttachment(null);
    onClose();
  };

  const handleSend = () => {
    setLocalRecipients([]);
    setSubject('');
    setBody('');
    setAttachment(null);
    onSend();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Mail — ${placement.insuranceCompany}`}
      width="sm:w-[30vw] sm:max-w-[40vw]"
      height="sm:h-[70vh] sm:max-h-[90vh]"
      fullScreenMobile
      footer={
        <div className="flex items-end justify-between gap-4 w-full">
          <FileUpload
            label=""
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            value={attachment}
            onChange={setAttachment}
          />
          <div className="flex gap-3 shrink-0">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSend}>Send</Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Recipients */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-gray-900">Recipient(s)</label>

          <div
            className={inputClass(
              undefined,
              'bg-gray-50 flex flex-wrap items-center gap-1.5 min-h-10.5',
            )}
          >
            {localRecipients.map((email) => (
              <span key={email} className="inline-flex items-center gap-1 text-sm text-gray-700">
                {email}
                <button
                  type="button"
                  onClick={() => removeRecipient(email)}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Icons.X className="w-3 h-3" />
                </button>
                <span className="text-gray-300">,</span>
              </span>
            ))}
            {!addingRecipient && (
              <button
                type="button"
                onClick={() => setAddingRecipient(true)}
                className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand/80 transition-colors"
              >
                <Icons.Plus className="w-3 h-3" />
                Add
              </button>
            )}
          </div>

          {addingRecipient && (
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <CreatableSearchSelect
                  placeholder="Type or paste email…"
                  options={[]}
                  value={recipientDraft}
                  onChange={setRecipientDraft}
                />
              </div>
              <button
                type="button"
                onClick={() => commitRecipient(recipientDraft)}
                className="shrink-0 text-xs font-medium text-brand hover:text-brand/80 transition-colors px-2 py-1"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingRecipient(false);
                  setRecipientDraft('');
                }}
                className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
              >
                <Icons.X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Subject */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-gray-900">Email Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={`Facultative Offer — ${placement.policyNumber}`}
            className={inputClass()}
          />
        </div>

        {/* Body */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-gray-900">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message here…"
            rows={8}
            className={inputClass(undefined, 'resize-none')}
          />
        </div>
      </div>
    </Modal>
  );
}
