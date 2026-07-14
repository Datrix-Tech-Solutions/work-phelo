'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, FileText, FolderOpen, Paperclip, ShieldCheck, Upload } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  usePlacementAttachmentDownload,
  usePlacementAttachments,
  usePlacementDocuments,
  useRenderPlacementDocumentPdf,
  useUploadPlacementAttachment,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { openPdfBlob } from '@/lib/openPdfBlob';
import { useToastStore } from '@/store/toast.store';
import {
  PlacementAttachment,
  PlacementDocument,
  PlacementDocumentStatus,
  PlacementDocumentType,
} from '@/types/reinsurance';

interface PlacementDocumentCentreTabProps {
  placementId: string;
  tenantSlug: string;
  onOpenClosings: () => void;
  onOpenEndorsements: () => void;
}

interface DocumentSectionProps {
  title: string;
  description: string;
  documents: PlacementDocument[];
  isLoading: boolean;
  renderingDocumentId: string | null;
  getDocumentState: (document: PlacementDocument) => DocumentLifecycleState;
  onViewPdf: (document: PlacementDocument) => void;
}

type DocumentLifecycleState = 'CURRENT' | 'SUPERSEDED' | 'VOID' | 'FAILED';
type DocumentTypeFilter = PlacementDocumentType | 'ALL';
type DocumentStatusFilter = PlacementDocumentStatus | 'ALL';
type DocumentStateFilter = DocumentLifecycleState | 'ALL';

const PDF_TYPES = new Set<PlacementDocumentType>([
  'OFFER_SLIP',
  'CLOSING_SLIP',
  'DEBIT_NOTE',
  'CREDIT_NOTE',
  'ENDORSEMENT_DEBIT_NOTE',
  'ENDORSEMENT_CREDIT_NOTE',
]);

const DOCUMENT_TYPE_FILTER_OPTIONS: { value: DocumentTypeFilter; label: string }[] = [
  { value: 'ALL', label: 'All document types' },
  { value: 'OFFER_SLIP', label: 'Offer Slip' },
  { value: 'CLOSING_SLIP', label: 'Closing Slip' },
  { value: 'DEBIT_NOTE', label: 'Debit Note' },
  { value: 'CREDIT_NOTE', label: 'Credit Note' },
  { value: 'ENDORSEMENT_DEBIT_NOTE', label: 'Endorsement Debit Note' },
  { value: 'ENDORSEMENT_CREDIT_NOTE', label: 'Endorsement Credit Note' },
];

const DOCUMENT_STATUS_FILTER_OPTIONS: { value: DocumentStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'GENERATED', label: 'Generated' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'VOID', label: 'Void' },
];

const DOCUMENT_STATE_FILTER_OPTIONS: { value: DocumentStateFilter; label: string }[] = [
  { value: 'ALL', label: 'All states' },
  { value: 'CURRENT', label: 'Current' },
  { value: 'SUPERSEDED', label: 'Superseded' },
  { value: 'VOID', label: 'Void' },
  { value: 'FAILED', label: 'Failed' },
];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function nestedValue(value: unknown, path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    current = asRecord(current)?.[key];
    if (current == null) return undefined;
  }
  return current;
}

function nestedString(value: unknown, path: string[]): string | undefined {
  const result = nestedValue(value, path);
  return typeof result === 'string' && result.trim() ? result : undefined;
}

function documentCounterparty(document: PlacementDocument) {
  const payload = document.renderPayload;
  return (
    nestedString(payload, ['offerContext', 'reinsurerName']) ??
    nestedString(payload, ['participantPreview', 'participant', 'counterparty', 'name']) ??
    nestedString(payload, ['closing', 'participant', 'counterparty', 'name']) ??
    nestedString(payload, [
      'endorsementClosing',
      'endorsementParticipant',
      'counterparty',
      'name',
    ]) ??
    nestedString(payload, ['note', 'counterparty', 'name']) ??
    nestedString(document.sourceSnapshot, ['counterparty', 'name']) ??
    '—'
  );
}

function documentReference(document: PlacementDocument) {
  const payload = document.renderPayload;
  return (
    nestedString(payload, ['closing', 'closingNumber']) ??
    nestedString(payload, ['endorsementClosing', 'closingNumber']) ??
    nestedString(payload, ['note', 'noteNumber']) ??
    nestedString(payload, ['placement', 'reference']) ??
    '—'
  );
}

function documentTypeLabel(document: PlacementDocument) {
  if (document.type === 'CLOSING_SLIP' && document.endorsementClosingId) {
    return 'Endorsement Closing Slip';
  }
  const labels: Record<PlacementDocumentType, string> = {
    OFFER_SLIP: 'Offer Slip',
    CLOSING_SLIP: 'Closing Slip',
    DEBIT_NOTE: 'Debit Note',
    CREDIT_NOTE: 'Credit Note',
    ENDORSEMENT_SLIP: 'Endorsement Slip',
    ENDORSEMENT_DEBIT_NOTE: 'Endorsement Debit Note',
    ENDORSEMENT_CREDIT_NOTE: 'Endorsement Credit Note',
    CLAIM_CASH_CALL: 'Claim Cash Call',
    CLAIM_NOTICE: 'Claim Notice',
  };
  return labels[document.type];
}

function documentStatus(document: PlacementDocument) {
  if (document.status === 'VOID') return 'Void';
  const noteStatus = nestedString(document.renderPayload, ['note', 'status']);
  if (noteStatus) return toTitleCase(noteStatus);
  return toTitleCase(document.status);
}

function documentScopeKey(document: PlacementDocument) {
  return [
    document.type,
    document.participantId ?? 'placement',
    document.closingId ?? 'no-closing',
    document.noteId ?? 'no-note',
    document.endorsementId ?? 'no-endorsement',
    document.endorsementClosingId ?? 'no-endorsement-closing',
    document.claimId ?? 'no-claim',
    document.claimCashCallId ?? 'no-cash-call',
  ].join(':');
}

function isVoidLikeDocument(document: PlacementDocument) {
  return (
    document.status === 'VOID' ||
    nestedString(document.renderPayload, ['note', 'status']) === 'VOID'
  );
}

function stateLabel(state: DocumentLifecycleState) {
  switch (state) {
    case 'CURRENT':
      return 'Current';
    case 'SUPERSEDED':
      return 'Superseded';
    case 'FAILED':
      return 'Failed';
    case 'VOID':
      return 'Void';
  }
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function createdByLabel(userId: string) {
  return userId ? `User ${userId.slice(0, 8)}` : '—';
}

function statusClass(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'ISSUED' || normalized === 'GENERATED' || normalized === 'ACTIVE') {
    return 'border-green-200 bg-green-50 text-green-700';
  }
  if (normalized === 'VOID' || normalized === 'FAILED') {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function stateClass(state: DocumentLifecycleState) {
  switch (state) {
    case 'CURRENT':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'SUPERSEDED':
      return 'border-gray-200 bg-gray-50 text-gray-600';
    case 'FAILED':
    case 'VOID':
      return 'border-red-200 bg-red-50 text-red-700';
  }
}

function DocumentSection({
  title,
  description,
  documents,
  isLoading,
  renderingDocumentId,
  getDocumentState,
  onViewPdf,
}: DocumentSectionProps) {
  return (
    <section className="overflow-hidden rounded-card border border-gray-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
          {documents.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-5 py-3">Document Number</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Counterparty</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Created By</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-5 py-10 text-center text-gray-400">
                  Loading documents...
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-5 py-10 text-center text-gray-400">
                  No documents in this section yet.
                </td>
              </tr>
            ) : (
              documents.map((document) => {
                const status = documentStatus(document);
                const state = getDocumentState(document);
                const canRender = PDF_TYPES.has(document.type);
                return (
                  <tr key={document.id} className="text-gray-700">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {document.documentNumber}
                    </td>
                    <td className="px-4 py-3">{documentTypeLabel(document)}</td>
                    <td className="px-4 py-3">{documentReference(document)}</td>
                    <td className="px-4 py-3">{documentCounterparty(document)}</td>
                    <td className="px-4 py-3">v{document.version}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(
                          status,
                        )}`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${stateClass(
                          state,
                        )}`}
                      >
                        {stateLabel(state)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(document.generatedAt ?? document.createdAt)}
                    </td>
                    <td className="px-4 py-3" title={document.createdByUserId}>
                      {createdByLabel(document.createdByUserId)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canRender && document.status !== 'FAILED' && document.status !== 'VOID' ? (
                        <button
                          type="button"
                          onClick={() => onViewPdf(document)}
                          disabled={renderingDocumentId === document.id}
                          className="inline-flex items-center gap-1.5 rounded-input border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <FileText className="h-4 w-4 text-red-600" />
                          {renderingDocumentId === document.id ? 'Opening...' : 'View PDF'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">PDF unavailable</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PlacementDocumentCentreTab({
  placementId,
  tenantSlug,
  onOpenClosings,
  onOpenEndorsements,
}: PlacementDocumentCentreTabProps) {
  const [renderingDocumentId, setRenderingDocumentId] = useState<string | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<DocumentTypeFilter>('ALL');
  const [documentStatusFilter, setDocumentStatusFilter] = useState<DocumentStatusFilter>('ALL');
  const [documentStateFilter, setDocumentStateFilter] = useState<DocumentStateFilter>('ALL');

  const {
    data: documents = [],
    isLoading: documentsLoading,
    isError: documentsError,
  } = usePlacementDocuments(placementId);
  const {
    data: attachments = [],
    isLoading: attachmentsLoading,
    isError: attachmentsError,
  } = usePlacementAttachments(placementId);
  const renderDocumentPdf = useRenderPlacementDocumentPdf(placementId);
  const downloadAttachment = usePlacementAttachmentDownload(placementId);
  const uploadAttachment = useUploadPlacementAttachment(placementId);
  const addToast = useToastStore((state) => state.addToast);

  const latestCurrentDocumentIds = new Set<string>();
  const latestByScope = new Map<string, PlacementDocument>();

  documents.forEach((document) => {
    if (document.status === 'FAILED' || isVoidLikeDocument(document)) return;
    const key = documentScopeKey(document);
    const current = latestByScope.get(key);
    if (
      !current ||
      document.version > current.version ||
      (document.version === current.version &&
        Date.parse(document.createdAt) > Date.parse(current.createdAt))
    ) {
      latestByScope.set(key, document);
    }
  });

  latestByScope.forEach((document) => latestCurrentDocumentIds.add(document.id));

  const getDocumentState = (document: PlacementDocument): DocumentLifecycleState => {
    if (document.status === 'FAILED') return 'FAILED';
    if (isVoidLikeDocument(document)) return 'VOID';
    return latestCurrentDocumentIds.has(document.id) ? 'CURRENT' : 'SUPERSEDED';
  };

  const sortedDocuments = [...documents].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );

  const filteredDocuments = sortedDocuments.filter((document) => {
    if (documentTypeFilter !== 'ALL' && document.type !== documentTypeFilter) return false;
    if (documentStatusFilter !== 'ALL' && document.status !== documentStatusFilter) return false;
    if (documentStateFilter !== 'ALL' && getDocumentState(document) !== documentStateFilter) {
      return false;
    }
    return true;
  });

  const offerSlips = filteredDocuments.filter((document) => document.type === 'OFFER_SLIP');
  const closingSlips = filteredDocuments.filter(
    (document) =>
      document.type === 'CLOSING_SLIP' && !document.endorsementId && !document.endorsementClosingId,
  );
  const placementNotes = filteredDocuments.filter(
    (document) =>
      (document.type === 'DEBIT_NOTE' || document.type === 'CREDIT_NOTE') &&
      !document.endorsementId,
  );
  const endorsementDocuments = filteredDocuments.filter(
    (document) =>
      (document.endorsementId || document.endorsementClosingId) &&
      (document.type === 'CLOSING_SLIP' ||
        document.type === 'ENDORSEMENT_DEBIT_NOTE' ||
        document.type === 'ENDORSEMENT_CREDIT_NOTE'),
  );
  const shownDocumentIds = new Set(
    [...offerSlips, ...closingSlips, ...placementNotes, ...endorsementDocuments].map(
      (document) => document.id,
    ),
  );
  const otherRegisteredDocuments = filteredDocuments.filter(
    (document) => !shownDocumentIds.has(document.id),
  );

  const handleViewPdf = async (document: PlacementDocument) => {
    setRenderingDocumentId(document.id);
    try {
      const pdf = await renderDocumentPdf.mutateAsync(document.id);
      openPdfBlob(pdf, `${document.documentNumber}.pdf`);
    } catch (error) {
      addToast({
        message: extractError(error, 'Failed to open document PDF'),
        type: 'error',
      });
    } finally {
      setRenderingDocumentId(null);
    }
  };

  const handleDownloadAttachment = async (attachment: PlacementAttachment) => {
    setDownloadingAttachmentId(attachment.id);
    try {
      const download = await downloadAttachment.mutateAsync(attachment.id);
      const link = window.document.createElement('a');
      link.href = download.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    } catch (error) {
      addToast({
        message: extractError(error, 'Failed to open attachment'),
        type: 'error',
      });
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const resetUpload = () => {
    setUploadOpen(false);
    setUploadFile(null);
    setUploadTitle('');
    setUploadDescription('');
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    try {
      await uploadAttachment.mutateAsync({
        file: uploadFile,
        title: uploadTitle,
        description: uploadDescription,
      });
      addToast({ message: 'Attachment uploaded', type: 'success' });
      resetUpload();
    } catch (error) {
      addToast({
        message: extractError(error, 'Failed to upload attachment'),
        type: 'error',
      });
    }
  };

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 rounded-card border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-red-50 p-2.5 text-red-700">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Placement Document Centre</h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Official backend-generated records are grouped below. Each PDF opens from its
                immutable saved document version.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setUploadOpen(true)}
            icon={<Upload className="h-4 w-4" />}
          >
            Upload Attachment
          </Button>
        </div>

        {documentsError && (
          <div className="rounded-input border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            The document registry could not be loaded. Refresh the page to try again.
          </div>
        )}

        <div className="grid gap-3 rounded-card border border-gray-200 bg-white p-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Type
            <select
              value={documentTypeFilter}
              onChange={(event) => setDocumentTypeFilter(event.target.value as DocumentTypeFilter)}
              className="rounded-input border border-gray-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900 outline-none focus:ring-1 focus:ring-gray-400"
            >
              {DOCUMENT_TYPE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Status
            <select
              value={documentStatusFilter}
              onChange={(event) =>
                setDocumentStatusFilter(event.target.value as DocumentStatusFilter)
              }
              className="rounded-input border border-gray-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900 outline-none focus:ring-1 focus:ring-gray-400"
            >
              {DOCUMENT_STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Current State
            <select
              value={documentStateFilter}
              onChange={(event) =>
                setDocumentStateFilter(event.target.value as DocumentStateFilter)
              }
              className="rounded-input border border-gray-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900 outline-none focus:ring-1 focus:ring-gray-400"
            >
              {DOCUMENT_STATE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <DocumentSection
          title="Offer Slips"
          description="Participant-specific offers addressed to each reinsurer."
          documents={offerSlips}
          isLoading={documentsLoading}
          renderingDocumentId={renderingDocumentId}
          getDocumentState={getDocumentState}
          onViewPdf={handleViewPdf}
        />
        <DocumentSection
          title="Closing Slips"
          description="Official placement closing contracts generated for validated reinsurer lines."
          documents={closingSlips}
          isLoading={documentsLoading}
          renderingDocumentId={renderingDocumentId}
          getDocumentState={getDocumentState}
          onViewPdf={handleViewPdf}
        />
        <DocumentSection
          title="Placement Notes"
          description="Persisted cedant debit notes and reinsurer credit notes, including lifecycle status."
          documents={placementNotes}
          isLoading={documentsLoading}
          renderingDocumentId={renderingDocumentId}
          getDocumentState={getDocumentState}
          onViewPdf={handleViewPdf}
        />
        <DocumentSection
          title="Endorsement Documents"
          description="Versioned endorsement closing slips, debit notes, and credit notes."
          documents={endorsementDocuments}
          isLoading={documentsLoading}
          renderingDocumentId={renderingDocumentId}
          getDocumentState={getDocumentState}
          onViewPdf={handleViewPdf}
        />

        {otherRegisteredDocuments.length > 0 && (
          <DocumentSection
            title="Other Registered Documents"
            description="Backend-saved records whose PDF format is not yet available in this workflow."
            documents={otherRegisteredDocuments}
            isLoading={documentsLoading}
            renderingDocumentId={renderingDocumentId}
            getDocumentState={getDocumentState}
            onViewPdf={handleViewPdf}
          />
        )}

        <section className="overflow-hidden rounded-card border border-gray-200 bg-white">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Attachments</h3>
              <p className="mt-1 text-xs text-gray-500">
                Private supporting files uploaded directly against this placement.
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              {attachments.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3">File</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Created By</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {attachmentsLoading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-gray-400">
                      Loading attachments...
                    </td>
                  </tr>
                ) : attachmentsError ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-red-600">
                      Unable to load attachments.
                    </td>
                  </tr>
                ) : attachments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-gray-400">
                      No placement attachments yet.
                    </td>
                  </tr>
                ) : (
                  attachments.map((attachment) => (
                    <tr key={attachment.id} className="text-gray-700">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {attachment.originalFileName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{attachment.title ?? '—'}</td>
                      <td className="px-4 py-3">{formatSize(attachment.sizeBytes)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(
                            attachment.status,
                          )}`}
                        >
                          {toTitleCase(attachment.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{formatDate(attachment.createdAt)}</td>
                      <td className="px-4 py-3" title={attachment.createdByUserId}>
                        {createdByLabel(attachment.createdByUserId)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {attachment.status === 'ACTIVE' ? (
                          <button
                            type="button"
                            onClick={() => handleDownloadAttachment(attachment)}
                            disabled={downloadingAttachmentId === attachment.id}
                            className="inline-flex items-center gap-1.5 rounded-input border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Download className="h-4 w-4" />
                            {downloadingAttachmentId === attachment.id
                              ? 'Opening...'
                              : 'Open Attachment'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">Unavailable</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-card border border-dashed border-amber-300 bg-amber-50/50 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-700" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Preview-only templates</h3>
                <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                  Not backend persisted
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-600">
                These templates remain available in their business workflows, but they are not
                official saved PDF records and are intentionally kept separate from the registry.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <PreviewOnlyLink
                  title="Guarantee Note"
                  location="Placement Closings"
                  onClick={onOpenClosings}
                />
                <PreviewOnlyLink
                  title="Endorsement Certificate"
                  location="Endorsement"
                  onClick={onOpenEndorsements}
                />
                <Link
                  href={`/${tenantSlug}/operations/reinsurance/claims`}
                  className="rounded-input border border-amber-200 bg-white p-3 transition hover:border-amber-400"
                >
                  <p className="text-sm font-medium text-gray-900">Claim Preview</p>
                  <p className="mt-1 text-xs text-gray-500">Open Claims · Preview only</p>
                </Link>
                <Link
                  href={`/${tenantSlug}/operations/reinsurance/payments`}
                  className="rounded-input border border-amber-200 bg-white p-3 transition hover:border-amber-400"
                >
                  <p className="text-sm font-medium text-gray-900">Payment Receipt</p>
                  <p className="mt-1 text-xs text-gray-500">Open Payments · Preview only</p>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Modal
        isOpen={uploadOpen}
        onClose={resetUpload}
        title="Upload placement attachment"
        description="Files are stored privately and linked to this placement. Maximum file size is 25 MB."
        footer={
          <>
            <Button variant="secondary" onClick={resetUpload}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              isLoading={uploadAttachment.isPending}
              loadingText="Uploading..."
              disabled={!uploadFile}
            >
              Upload
            </Button>
          </>
        }
      >
        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            File
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              className="rounded-input border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            Title <span className="font-normal text-gray-400">(optional)</span>
            <input
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              maxLength={160}
              placeholder="e.g. Signed policy schedule"
              className="rounded-input border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-gray-400"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            Description <span className="font-normal text-gray-400">(optional)</span>
            <textarea
              value={uploadDescription}
              onChange={(event) => setUploadDescription(event.target.value)}
              maxLength={1000}
              placeholder="Describe how this file supports the placement"
              className="min-h-24 rounded-input border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-gray-400"
            />
          </label>
        </div>
      </Modal>
    </>
  );
}

function PreviewOnlyLink({
  title,
  location,
  onClick,
}: {
  title: string;
  location: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-input border border-amber-200 bg-white p-3 text-left transition hover:border-amber-400"
    >
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="mt-1 text-xs text-gray-500">Open {location} · Preview only</p>
    </button>
  );
}
