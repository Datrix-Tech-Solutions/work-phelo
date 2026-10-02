'use client';

import { useMemo, useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { cn, cardClass, inputClass } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';
import { Button } from '@/components/atoms/Button';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { DocumentCard } from '@/components/molecules/hr/documents/DocumentCard';
import { DocumentFileIcon } from '@/components/molecules/hr/documents/DocumentFileIcon';
import { DocumentPreviewPanel } from '@/components/molecules/hr/documents/DocumentPreviewPanel';
import { formatFileSize, type MyDocument } from './types';

type ViewMode = 'table' | 'card';

interface Props {
  documents: MyDocument[];
  allowUpload?: boolean;
  allowDelete?: boolean;
  onDelete?: (doc: MyDocument) => void;
  isLoading?: boolean;
  /** Renders whichever upload modal fits this folder (personal vs company
   *  documents ask for different fields) — DocumentManagerPanel just owns
   *  the open/close state and the button that triggers it. */
  renderUploadModal?: (props: { isOpen: boolean; onClose: () => void }) => React.ReactNode;
  /** Fires whenever the selected document changes (including back to none) —
   *  lets a caller react, e.g. collapsing a sibling folder rail once the
   *  preview column appears. */
  onSelectionChange?: (doc: MyDocument | null) => void;
}

export function DocumentManagerPanel({
  documents,
  allowUpload = true,
  allowDelete = true,
  onDelete,
  isLoading,
  renderUploadModal,
  onSelectionChange,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.trim().toLowerCase();
    return documents.filter(
      (d) => d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q),
    );
  }, [documents, search]);

  const selected = documents.find((d) => d.id === selectedId) ?? null;

  const selectDocument = (doc: MyDocument | null) => {
    setSelectedId(doc?.id ?? null);
    onSelectionChange?.(doc);
  };

  const handleDownload = (doc: MyDocument) => {
    if (!doc.previewUrl) return;
    const a = window.document.createElement('a');
    a.href = doc.previewUrl;
    a.download = doc.name;
    a.click();
  };

  const handleDelete = (doc: MyDocument) => {
    onDelete?.(doc);
    if (selectedId === doc.id) selectDocument(null);
  };

  const columns: Column<MyDocument>[] = [
    {
      key: 'name',
      label: 'Document',
      width: '2fr',
      render: (doc) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <DocumentFileIcon kind={doc.fileKind} className="w-4 h-4 text-gray-500 shrink-0" />
          <span className="truncate font-medium text-gray-800">{doc.name}</span>
        </div>
      ),
    },
    { key: 'category', label: 'Category' },
    { key: 'sizeBytes', label: 'Size', render: (doc) => formatFileSize(doc.sizeBytes) },
    { key: 'uploadedAt', label: 'Uploaded', render: (doc) => formatDate(doc.uploadedAt) },
    { key: 'uploadedBy', label: 'Uploaded By' },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className={cardClass('px-4 py-2 flex items-center gap-3 flex-wrap')}>
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass(undefined, 'flex-1 min-w-52 max-w-sm')}
          />
          <div className="flex-1" />
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'table' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400',
              )}
              aria-label="Table view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'card' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400',
              )}
              aria-label="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          {allowUpload && (
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              Upload Document
            </Button>
          )}
        </div>

        {viewMode === 'table' ? (
          <DataTable
            columns={columns}
            data={filtered}
            isLoading={isLoading}
            emptyMessage="No documents found"
            onRowClick={selectDocument}
            currentPage={1}
            totalPages={1}
            onPageChange={() => {}}
            noInternalScroll
          />
        ) : (
          <div className={cardClass('p-4')}>
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No documents found</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    selected={doc.id === selectedId}
                    onSelect={selectDocument}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <DocumentPreviewPanel
          document={selected}
          onDownload={handleDownload}
          onDelete={allowDelete ? handleDelete : undefined}
          canDelete={allowDelete}
          onClose={() => selectDocument(null)}
        />
      )}

      {allowUpload &&
        renderUploadModal?.({
          isOpen: uploadOpen,
          onClose: () => setUploadOpen(false),
        })}
    </div>
  );
}
