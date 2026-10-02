import { Download, Trash2, X } from 'lucide-react';
import { cardClass } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';
import { Button } from '@/components/atoms/Button';
import { DocumentFileIcon } from './DocumentFileIcon';
import { formatFileSize, type MyDocument } from '@/components/organisms/hr/documents/types';

interface Props {
  document: MyDocument;
  onDownload?: (doc: MyDocument) => void;
  onDelete?: (doc: MyDocument) => void;
  canDelete?: boolean;
  /** Deselects the document without touching a sibling folder rail's
   *  collapsed state — that only resets when the folder itself changes. */
  onClose?: () => void;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right truncate">{value}</span>
    </div>
  );
}

export function DocumentPreviewPanel({
  document,
  onDownload,
  onDelete,
  canDelete = true,
  onClose,
}: Props) {
  const canRenderInline = document.fileKind === 'pdf' || document.fileKind === 'image';

  return (
    <div className={cardClass('w-full lg:w-80 shrink-0 flex flex-col overflow-hidden')}>
      <div className="relative h-64 shrink-0 overflow-hidden bg-gray-100 flex items-center justify-center">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {canRenderInline && document.previewUrl ? (
          document.fileKind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={document.previewUrl}
              alt={document.name}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <embed src={document.previewUrl} type="application/pdf" className="w-full h-full" />
          )
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <DocumentFileIcon kind={document.fileKind} className="w-10 h-10" />
            <span className="text-xs">No preview available</span>
          </div>
        )}

        {/* Fades the cut-off preview into the card's surface color below, instead of a
            hard edge — a plain color gradient, no glass/blur effect. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-6"
          style={{
            background:
              'linear-gradient(to bottom,' +
              ' transparent 0%,' +
              ' color-mix(in oklab, var(--glass-solid, var(--background)) 15%, transparent) 40%,' +
              ' color-mix(in oklab, var(--glass-solid, var(--background)) 60%, transparent) 70%,' +
              ' var(--glass-solid, var(--background)) 100%)',
          }}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <p className="text-sm font-semibold text-gray-900 wrap-break-word mb-3">{document.name}</p>

        <div>
          <MetaRow label="Category" value={document.category} />
          <MetaRow label="Type" value={document.mimeType} />
          <MetaRow label="Size" value={formatFileSize(document.sizeBytes)} />
          <MetaRow label="Uploaded" value={formatDate(document.uploadedAt)} />
          <MetaRow label="Uploaded by" value={document.uploadedBy} />
        </div>
      </div>

      <div className="p-4 pt-0 flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          className="flex-1"
          icon={<Download className="w-4 h-4" />}
          onClick={() => onDownload?.(document)}
        >
          Download
        </Button>
        {canDelete && (
          <Button
            size="sm"
            variant="danger"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={() => onDelete?.(document)}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
