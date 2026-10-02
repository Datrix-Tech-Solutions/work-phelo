import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';
import { DocumentFileIcon } from './DocumentFileIcon';
import { formatFileSize, type MyDocument } from '@/components/organisms/hr/documents/types';

interface Props {
  document: MyDocument;
  selected: boolean;
  onSelect: (doc: MyDocument) => void;
}

export function DocumentCard({ document, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(document)}
      className={cn(
        'flex flex-col gap-2 rounded-2xl border p-3 text-left transition-all duration-150',
        selected
          ? 'border-brand bg-brand-tint ring-2 ring-brand/30'
          : 'border-gray-200 bg-gray-50 hover:border-brand hover:bg-brand-tint hover:-translate-y-0.5 hover:shadow-lg',
      )}
    >
      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
        <DocumentFileIcon kind={document.fileKind} className="w-5 h-5 text-gray-600" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{document.name}</p>
        <p className="text-xs text-gray-400">{document.category}</p>
      </div>
      <div className="border-t border-gray-200 pt-2 flex items-center justify-between text-xs text-gray-500">
        <span>{formatFileSize(document.sizeBytes)}</span>
        <span>{formatDate(document.uploadedAt)}</span>
      </div>
    </button>
  );
}
