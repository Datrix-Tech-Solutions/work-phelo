'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FileUpload } from '@/components/atoms/FileUpload';
import { CreatableSearchSelect } from '@/components/atoms/CreatableSearchSelect';
import { RichTextEditor } from '@/components/molecules/shared/RichTextEditor';
import { Icons } from '@/components/atoms/icons';
import { inputClass } from '@/lib/utils';
import {
  usePlacementAttachments,
  usePlacementDocuments,
  usePlacementEmailThreads,
  useReinsuranceMailboxes,
  useSendPlacementEmail,
  useUploadPlacementAttachment,
} from '@/hooks';
import { Facultative, PlacementClaim, PlacementClaimAllocation } from '@/types/reinsurance';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

const ATTACHABLE_DOCUMENT_TYPES = new Set(['OFFER_SLIP', 'CLOSING_SLIP']);

interface MailPreviewModalProps {
  isOpen: boolean;
  placement: Facultative;
  brokerageFee: number;
  recipients: string[];
  onSend: () => void;
  onClose: () => void;
  onClosePlacement?: () => void;
  claim?: PlacementClaim;
  allocation?: PlacementClaimAllocation;
}

function uniqueEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  return emails
    .map((email) => email.trim())
    .filter((email) => {
      if (!email || seen.has(email.toLowerCase())) return false;
      seen.add(email.toLowerCase());
      return true;
    });
}

function parseRecipientList(value: string) {
  return uniqueEmails(value.split(/[,;\n]/)).map((email) => ({ email }));
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function defaultSubject(placement: Facultative, claim?: PlacementClaim) {
  if (claim) return `Claim notice - ${placement.reference}`;
  return `Reinsurance Placement - ${placement.reference} - ${placement.title}`;
}

function defaultBody(placement: Facultative, claim?: PlacementClaim) {
  if (claim) {
    return `<p>Dear Partner,</p><p>Please review the claim communication for placement <strong>${placement.reference}</strong>.</p><p>This is a preview only in Phase 1. No email will be sent from this action.</p>`;
  }

  return `<p>Dear Partner,</p><p>Please review the attached document(s) for reinsurance placement <strong>${placement.reference}</strong> - ${placement.title}.</p><p>Kindly confirm receipt and revert with any questions.</p>`;
}

export function MailPreviewModal({
  isOpen,
  placement,
  recipients,
  onSend,
  onClose,
  claim,
  allocation,
}: MailPreviewModalProps) {
  const [localRecipients, setLocalRecipients] = useState<string[]>(recipients);
  const [addingRecipient, setAddingRecipient] = useState(false);
  const [recipientDraft, setRecipientDraft] = useState('');
  const [subject, setSubject] = useState(defaultSubject(placement, claim));
  const [body, setBody] = useState(defaultBody(placement, claim));
  const [ccDraft, setCcDraft] = useState('');
  const [bccDraft, setBccDraft] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<string[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState('');

  const isClaimPreviewOnly = Boolean(claim);
  const mailboxesQuery = useReinsuranceMailboxes({ enabled: isOpen && !isClaimPreviewOnly });
  const documentsQuery = usePlacementDocuments(placement.id, {
    enabled: isOpen && !isClaimPreviewOnly,
  });
  const attachmentsQuery = usePlacementAttachments(placement.id, {
    enabled: isOpen && !isClaimPreviewOnly,
  });
  const threadsQuery = usePlacementEmailThreads(placement.id, {
    enabled: isOpen && !isClaimPreviewOnly,
  });
  const sendPlacementEmail = useSendPlacementEmail(placement.id);
  const uploadPlacementAttachment = useUploadPlacementAttachment(placement.id);
  const addToast = useToastStore((s) => s.addToast);

  const activeMailboxes = useMemo(
    () => (mailboxesQuery.data ?? []).filter((mailbox) => mailbox.status === 'ACTIVE'),
    [mailboxesQuery.data],
  );

  const attachableDocuments = useMemo(
    () =>
      (documentsQuery.data ?? []).filter(
        (document) => document.status !== 'VOID' && ATTACHABLE_DOCUMENT_TYPES.has(document.type),
      ),
    [documentsQuery.data],
  );

  const activeAttachments = useMemo(
    () => (attachmentsQuery.data ?? []).filter((item) => item.status === 'ACTIVE'),
    [attachmentsQuery.data],
  );

  const effectiveMailboxId = selectedMailboxId || activeMailboxes[0]?.id || '';

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

  const resetForm = () => {
    setLocalRecipients(uniqueEmails(recipients));
    setAddingRecipient(false);
    setRecipientDraft('');
    setSubject(defaultSubject(placement, claim));
    setBody(defaultBody(placement, claim));
    setCcDraft('');
    setBccDraft('');
    setAttachment(null);
    setSelectedDocumentIds([]);
    setSelectedAttachmentIds([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const toggleDocument = (documentId: string) => {
    setSelectedDocumentIds((prev) =>
      prev.includes(documentId) ? prev.filter((id) => id !== documentId) : [...prev, documentId],
    );
  };

  const toggleAttachment = (attachmentId: string) => {
    setSelectedAttachmentIds((prev) =>
      prev.includes(attachmentId)
        ? prev.filter((id) => id !== attachmentId)
        : [...prev, attachmentId],
    );
  };

  const handleUploadAttachment = async () => {
    if (!attachment) return;
    try {
      const uploaded = await uploadPlacementAttachment.mutateAsync({
        file: attachment,
        title: attachment.name,
      });
      setSelectedAttachmentIds((prev) => uniqueEmails([...prev, uploaded.id]));
      setAttachment(null);
      addToast({ message: 'Attachment uploaded and selected.', type: 'success' });
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  const handleSend = async () => {
    if (isClaimPreviewOnly) {
      addToast({
        message: 'Claim email is preview-only in Phase 1. No email was sent.',
        type: 'success',
      });
      resetForm();
      onSend();
      return;
    }

    if (!effectiveMailboxId) {
      addToast({ message: 'Connect a mailbox before sending email.', type: 'error' });
      return;
    }

    if (localRecipients.length === 0) {
      addToast({ message: 'Add at least one recipient before sending email.', type: 'error' });
      return;
    }

    try {
      let attachmentIds = selectedAttachmentIds;
      if (attachment) {
        const uploaded = await uploadPlacementAttachment.mutateAsync({
          file: attachment,
          title: attachment.name,
        });
        attachmentIds = [...attachmentIds, uploaded.id];
        setSelectedAttachmentIds(attachmentIds);
        setAttachment(null);
      }

      await sendPlacementEmail.mutateAsync({
        mailboxConnectionId: effectiveMailboxId,
        to: localRecipients.map((email) => ({ email })),
        cc: parseRecipientList(ccDraft),
        bcc: parseRecipientList(bccDraft),
        subject,
        bodyHtml: body,
        bodyText: stripHtml(body),
        documentIds: selectedDocumentIds,
        attachmentIds,
      });

      addToast({ message: 'Email sent and saved to placement history.', type: 'success' });
      resetForm();
      onSend();
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  const isSending = sendPlacementEmail.isPending || uploadPlacementAttachment.isPending;
  const canSend =
    isClaimPreviewOnly ||
    Boolean(effectiveMailboxId && localRecipients.length > 0 && subject.trim() && !isSending);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`${isClaimPreviewOnly ? 'Preview Email' : 'Send Email'} — ${placement.cedant.name}`}
      width="sm:w-[50vw] sm:max-w-[60vw]"
      height="sm:h-[80vh] sm:max-h-[90vh]"
      fullScreenMobile
      footer={
        <div className="flex items-end justify-between gap-4 w-full">
          {!isClaimPreviewOnly && (
            <div className="flex items-end gap-2 flex-1">
              <div className="flex-1">
                <FileUpload
                  label=""
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  value={attachment}
                  onChange={setAttachment}
                />
              </div>
              <Button
                variant="outline"
                onClick={handleUploadAttachment}
                disabled={!attachment || uploadPlacementAttachment.isPending}
                isLoading={uploadPlacementAttachment.isPending}
                loadingText="Uploading…"
              >
                Upload
              </Button>
            </div>
          )}
          <div className="flex gap-3 shrink-0">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={!canSend}
              isLoading={isSending}
              loadingText="Sending…"
            >
              {isClaimPreviewOnly ? 'Preview Email' : 'Send Email'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {isClaimPreviewOnly ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Claim email sending is not integrated in Phase 1. This modal is a preview only and will
            not notify the reinsurer or update claim/cash-call status.
            {allocation ? (
              <span className="block mt-1 text-xs">Allocation reference: {allocation.id}</span>
            ) : null}
          </div>
        ) : null}

        {!isClaimPreviewOnly && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-900">Sending mailbox</label>
            {activeMailboxes.length > 0 ? (
              <select
                value={effectiveMailboxId}
                onChange={(e) => setSelectedMailboxId(e.target.value)}
                className={inputClass()}
              >
                {activeMailboxes.map((mailbox) => (
                  <option key={mailbox.id} value={mailbox.id}>
                    {mailbox.displayName
                      ? `${mailbox.displayName} <${mailbox.emailAddress}>`
                      : mailbox.emailAddress}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Connect a mailbox before sending email.
              </div>
            )}
          </div>
        )}

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
          {localRecipients.length === 0 && (
            <p className="text-xs text-amber-600">
              No reliable contact email is available. Add a recipient manually before sending.
            </p>
          )}

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

        {!isClaimPreviewOnly && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-gray-900">CC</label>
              <input
                type="text"
                value={ccDraft}
                onChange={(e) => setCcDraft(e.target.value)}
                placeholder="email@example.com, team@example.com"
                className={inputClass()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-gray-900">BCC</label>
              <input
                type="text"
                value={bccDraft}
                onChange={(e) => setBccDraft(e.target.value)}
                placeholder="email@example.com"
                className={inputClass()}
              />
            </div>
          </div>
        )}

        {/* Subject */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-gray-900">Email Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={`Facultative Offer — ${placement.reference}`}
            className={inputClass()}
          />
        </div>

        {/* Body */}
        <RichTextEditor
          label="Body"
          value={body}
          onChange={setBody}
          placeholder="Write your message here…"
          minHeight={200}
        />

        {!isClaimPreviewOnly && (
          <>
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Backend documents</h4>
                  <p className="text-xs text-gray-500">
                    Only persisted Offer Slip and Closing Slip documents can be attached in Phase 1.
                  </p>
                </div>
                {documentsQuery.isFetching && (
                  <span className="text-xs text-gray-400">Refreshing…</span>
                )}
              </div>
              {attachableDocuments.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {attachableDocuments.map((document) => (
                    <label
                      key={document.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocumentIds.includes(document.id)}
                        onChange={() => toggleDocument(document.id)}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="font-medium text-gray-900">{document.title}</span>
                        <span className="block text-xs text-gray-500">
                          {document.documentNumber} · {document.type.replace(/_/g, ' ')} · v
                          {document.version}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No attachable backend offer or closing slip documents exist yet.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Uploaded attachments</h4>
                  <p className="text-xs text-gray-500">
                    Upload files first, then select the saved attachment for this email.
                  </p>
                </div>
                {attachmentsQuery.isFetching && (
                  <span className="text-xs text-gray-400">Refreshing…</span>
                )}
              </div>
              {activeAttachments.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {activeAttachments.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAttachmentIds.includes(item.id)}
                        onChange={() => toggleAttachment(item.id)}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="font-medium text-gray-900">
                          {item.title || item.originalFileName}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {item.mimeType} · {formatBytes(item.sizeBytes)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No uploaded placement attachments are available yet.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Email history</h4>
                  <p className="text-xs text-gray-500">Recent backend-linked placement threads.</p>
                </div>
                {threadsQuery.isFetching && <span className="text-xs text-gray-400">Loading…</span>}
              </div>
              {(threadsQuery.data ?? []).length > 0 ? (
                <div className="flex flex-col divide-y divide-gray-100">
                  {(threadsQuery.data ?? []).slice(0, 5).map((thread) => (
                    <div key={thread.threadId} className="py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-900 truncate">
                          {thread.subject || 'No subject'}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {formatDate(thread.latestMessageAt ?? thread.linkedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {thread.mailbox.emailAddress} · {thread.messageCount} message
                        {thread.messageCount === 1 ? '' : 's'}
                        {thread.hasAttachments ? ' · attachments' : ''}
                      </p>
                      {thread.latestMessagePreview && (
                        <p className="text-xs text-gray-500 truncate mt-1">
                          {thread.latestMessagePreview}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No backend email history for this placement.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
