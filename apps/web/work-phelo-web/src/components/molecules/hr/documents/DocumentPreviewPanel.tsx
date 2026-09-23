import { Download, Trash2, FolderOpen } from 'lucide-react';
import { cardClass } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';
import { Button } from '@/components/atoms/Button';
import { DocumentFileIcon } from './DocumentFileIcon';
import { formatFileSize, type MyDocument } from '@/components/organisms/hr/documents/types';

interface Props {
  document: MyDocument | null;
  onDownload?: (doc: MyDocument) => void;
  onDelete?: (doc: MyDocument) => void;
  canDelete?: boolean;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right truncate">{value}</span>
    </div>
  );
}

export function DocumentPreviewPanel({ document, onDownload, onDelete, canDelete = true }: Props) {
  if (!document) {
    return (
      <div
        className={cardClass(
          'w-full lg:w-80 shrink-0 flex flex-col items-center justify-center gap-3 p-8 text-center',
        )}
      >
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
          <FolderOpen className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-500">Select a document to preview</p>
        <p className="text-xs text-gray-400">
          Its details, size, and upload history will show up here.
        </p>
      </div>
    );
  }

  const canRenderInline = document.fileKind === 'pdf' || document.fileKind === 'image';

  return (
    <div className={cardClass('w-full lg:w-80 shrink-0 flex flex-col overflow-hidden')}>
      <div className="aspect-4/3 bg-gray-100 flex items-center justify-center border-b border-gray-100">
        {canRenderInline && document.previewUrl ? (
          document.fileKind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={document.previewUrl}
              alt={document.name}
              className="w-full h-full object-contain"
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
