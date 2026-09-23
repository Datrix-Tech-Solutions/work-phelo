'use client';

import { useMemo, useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { cn, cardClass, inputClass } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';
import { Button } from '@/components/atoms/Button';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { DocumentFoldersRail } from '@/components/molecules/hr/documents/DocumentFoldersRail';
import { DocumentCard } from '@/components/molecules/hr/documents/DocumentCard';
import { DocumentFileIcon } from '@/components/molecules/hr/documents/DocumentFileIcon';
import { DocumentPreviewPanel } from '@/components/molecules/hr/documents/DocumentPreviewPanel';
import { UploadDocumentModal } from './UploadDocumentModal';
import { formatFileSize, inferFileKind, type DocumentFolderKey, type MyDocument } from './types';

type ViewMode = 'table' | 'card';

export function MyDocumentsContent() {
  const [documents, setDocuments] = useState<MyDocument[]>([]);
  const [folder, setFolder] = useState<DocumentFolderKey>('personal');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const counts = useMemo(
    () => ({
      personal: documents.filter((d) => d.folder === 'personal').length,
      company: documents.filter((d) => d.folder === 'company').length,
    }),
    [documents],
  );

  const filtered = useMemo(() => {
    const inFolder = documents.filter((d) => d.folder === folder);
    if (!search.trim()) return inFolder;
    const q = search.trim().toLowerCase();
    return inFolder.filter(
      (d) => d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q),
    );
  }, [documents, folder, search]);

  const selected = documents.find((d) => d.id === selectedId) ?? null;

  const handleSelectFolder = (next: DocumentFolderKey) => {
    setFolder(next);
    setSelectedId(null);
  };

  const handleUpload = ({ file, category }: { file: File; category: string }) => {
    const doc: MyDocument = {
      id: `doc-${Date.now()}`,
      folder,
      name: file.name,
      fileKind: inferFileKind(file.type),
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: 'You',
      category,
      previewUrl: URL.createObjectURL(file),
    };
    setDocuments((prev) => [doc, ...prev]);
    setUploadOpen(false);
    setSelectedId(doc.id);
  };

  const handleDelete = (doc: MyDocument) => {
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    if (selectedId === doc.id) setSelectedId(null);
  };

  const handleDownload = (doc: MyDocument) => {
    if (!doc.previewUrl) return;
    const a = window.document.createElement('a');
    a.href = doc.previewUrl;
    a.download = doc.name;
    a.click();
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
    {
      key: 'sizeBytes',
      label: 'Size',
      render: (doc) => formatFileSize(doc.sizeBytes),
    },
    {
      key: 'uploadedAt',
      label: 'Uploaded',
      render: (doc) => formatDate(doc.uploadedAt),
    },
    { key: 'uploadedBy', label: 'Uploaded By' },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <DocumentFoldersRail active={folder} onSelect={handleSelectFolder} counts={counts} />

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
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            Upload Document
          </Button>
        </div>

        {viewMode === 'table' ? (
          <DataTable
            columns={columns}
            data={filtered}
            emptyMessage="No documents found"
            onRowClick={(doc) => setSelectedId(doc.id)}
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
                    onSelect={(d) => setSelectedId(d.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <DocumentPreviewPanel
        document={selected}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />

      <UploadDocumentModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        folder={folder}
        onUpload={handleUpload}
      />
    </div>
  );
}
