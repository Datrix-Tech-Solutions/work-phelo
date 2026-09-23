'use client';

import { useRef, useState } from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { cn, inputClass } from '@/lib/utils';
import { formatFileSize } from './types';
import type { DocumentFolderKey } from './types';

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const HINT = 'PDF, image, Word or Excel file · up to 15 MB';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  folder: DocumentFolderKey;
  onUpload: (input: { file: File; category: string }) => void;
  isUploading?: boolean;
}

export function UploadDocumentModal({ isOpen, onClose, folder, onUpload, isUploading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = (picked: File | undefined) => {
    if (!picked) return;
    if (picked.size > MAX_BYTES) {
      setError('That file is over 15 MB. Pick a smaller one.');
      return;
    }
    setError(null);
    setFile(picked);
  };

  const reset = () => {
    setFile(null);
    setCategory('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!file || !category.trim()) return;
    onUpload({ file, category: category.trim() });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Upload to ${folder === 'personal' ? 'Personal Documents' : 'Company Documents'}`}
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            disabled={!file || !category.trim()}
            isLoading={isUploading}
            onClick={handleSubmit}
          >
            Upload
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pt-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            accept(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            'flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-6 text-center transition-colors',
            dragging ? 'border-brand bg-brand/5' : 'border-gray-300 bg-gray-50',
          )}
        >
          {file ? (
            <div className="flex items-center gap-2 w-full max-w-full">
              <FileText className="w-5 h-5 text-gray-500 shrink-0" />
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-gray-400 hover:text-gray-600 shrink-0"
                aria-label="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <UploadCloud className="w-6 h-6 text-gray-400" />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-input border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Choose file
              </button>
              <p className="text-xs text-gray-400">
                Drag a file here, or <span className="text-gray-500">browse</span>. {HINT}
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            onChange={(e) => {
              accept(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Identification, Contract, Certificate"
            className={inputClass()}
          />
        </div>
      </div>
    </Modal>
  );
}
